import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {ImageKind,getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_SOURCE_BYTES=100*1024*1024,MAX_PAGES=500,MAX_IMAGES=100,MAX_PIXELS=12_000_000,MAX_IMAGE_BYTES=25*1024*1024,MAX_TOTAL_BYTES=50*1024*1024;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const CRC_TABLE=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let bit=0;bit<8;bit++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=CRC_TABLE[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(type,data){const name=Buffer.from(type),body=Buffer.concat([name,data]),crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));const length=Buffer.alloc(4);length.writeUInt32BE(data.length);return Buffer.concat([length,body,crc]);}

function pixelsToPng({width,height,kind,data}){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>MAX_PIXELS)throw new Error(`PDF image dimensions exceed supported limits: ${width}x${height}`);
  const pixelCount=width*height,rgba=Buffer.allocUnsafe(pixelCount*4);
  if(kind===ImageKind.RGBA_32BPP){if(data.length<pixelCount*4)throw new Error('PDF RGBA image data is truncated');Buffer.from(data.buffer,data.byteOffset,pixelCount*4).copy(rgba);}
  else if(kind===ImageKind.RGB_24BPP){if(data.length<pixelCount*3)throw new Error('PDF RGB image data is truncated');for(let i=0,j=0;i<pixelCount;i++,j+=3){const p=i*4;rgba[p]=data[j];rgba[p+1]=data[j+1];rgba[p+2]=data[j+2];rgba[p+3]=255;}}
  else if(kind===ImageKind.GRAYSCALE_1BPP){if(data.length<Math.ceil(pixelCount/8))throw new Error('PDF 1-bit grayscale image data is truncated');for(let i=0;i<pixelCount;i++){const value=data[i>>3]&(0x80>>(i&7))?255:0,p=i*4;rgba[p]=value;rgba[p+1]=value;rgba[p+2]=value;rgba[p+3]=255;}}
  else throw new Error(`Unsupported PDF image sample kind: ${kind}`);
  const stride=width*4,rowBytes=Buffer.allocUnsafe((stride+1)*height);for(let y=0;y<height;y++){const target=y*(stride+1);rowBytes[target]=0;rgba.copy(rowBytes,target+1,y*stride,(y+1)*stride);}
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(rowBytes)),pngChunk('IEND',Buffer.alloc(0))]);
}

export function splitInlineImageGroup(image,placements){
  if(image.kind!==ImageKind.RGBA_32BPP)throw new Error(`Unsupported grouped PDF inline-image sample kind: ${image.kind}`);
  if(!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width<1||image.height<1||image.width*image.height>MAX_PIXELS)throw new Error(`PDF grouped inline-image dimensions exceed supported limits: ${image.width}x${image.height}`);
  const source=Buffer.from(image.data.buffer,image.data.byteOffset,image.data.byteLength);
  if(source.length<image.width*image.height*4)throw new Error('Grouped PDF inline image data is truncated');
  return placements.map((placement,placementIndex)=>{
    const{x,y,w,h}=placement||{};
    if(![x,y,w,h].every(Number.isSafeInteger)||x<0||y<0||w<1||h<1||x+w>image.width||y+h>image.height)throw new Error(`Invalid grouped PDF inline-image placement ${placementIndex}`);
    if(w*h>MAX_PIXELS)throw new Error(`PDF image dimensions exceed supported limits: ${w}x${h}`);
    const data=Buffer.allocUnsafe(w*h*4);
    for(let row=0;row<h;row++)source.copy(data,row*w*4,((y+row)*image.width+x)*4,((y+row)*image.width+x+w)*4);
    return{width:w,height:h,kind:ImageKind.RGBA_32BPP,data};
  });
}

/** Extract bounded PDF image XObjects as PNGs; this is decoded image content, not page screenshots or original encoded streams. */
export async function extractPdfAssets(bytes,{filename='source.pdf'}={}){
  if(bytes.byteLength>MAX_SOURCE_BYTES)throw new Error('PDF source exceeds 100 MB limit');
  const standardFontDataUrl=fileURLToPath(new URL('../../standard_fonts/',import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'))).replaceAll('\\','/');
  const task=getDocument({data:new Uint8Array(bytes),standardFontDataUrl,isEvalSupported:false,enableXfa:false,useSystemFonts:false,maxImageSize:MAX_PIXELS,stopAtErrors:true}),pdf=await task.promise;
  if(pdf.numPages>MAX_PAGES){await pdf.destroy();throw new Error('PDF image extraction is limited to 500 pages');}
  const sourceHash=hash(bytes),assetsByHash=new Map(),assets=[],unsupported=new Set();let totalBytes=0,imageCount=0;
  try{
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      const page=await pdf.getPage(pageNumber),list=await page.getOperatorList();
      for(let index=0;index<list.fnArray.length;index++){
        const op=list.fnArray[index],args=list.argsArray[index];
        if(op===OPS.paintInlineImageXObject||op===OPS.paintInlineImageXObjectGroup){
          const image=Array.isArray(args)?args[0]:null,placements=op===OPS.paintInlineImageXObjectGroup&&Array.isArray(args?.[1])?args[1]:[null];if(!image||!placements.length)continue;
          imageCount+=placements.length;if(imageCount>MAX_IMAGES)throw new Error('PDF image extraction is limited to 100 image placements');
          if(!image.data||!Number.isInteger(image.width)||!Number.isInteger(image.height)){unsupported.add('unsupported-inline-image-data');continue;}if(image.data.byteLength>MAX_IMAGE_BYTES)throw new Error(`Decoded PDF inline image exceeds 25 MB limit on page ${pageNumber}`);
          const grouped=op===OPS.paintInlineImageXObjectGroup,images=grouped?splitInlineImageGroup(image,placements):[image];
          for(let placementIndex=0;placementIndex<images.length;placementIndex++){
            const item=images[placementIndex],raw=Buffer.from(item.data.buffer,item.data.byteOffset,item.data.byteLength),png=pixelsToPng({...item,data:raw});totalBytes+=png.length;if(totalBytes>MAX_TOTAL_BYTES)throw new Error('Extracted PDF images exceed 50 MB total');
            const digest=hash(png),reference={page:pageNumber,operator_index:index,operator:grouped?'paintInlineImageXObjectGroup':'paintInlineImageXObject',inline_image:true,placement_index:placementIndex,source_image_sha256:hash(raw)},previous=assetsByHash.get(digest);if(previous){previous.source_parts.push(reference);continue;}
            const asset={asset_id:`A_PDF_${digest.slice(0,16).toUpperCase()}`,path:`assets/${digest.slice(0,20)}.png`,type:'image/png',mime_type:'image/png',sha256:digest,source:`Decoded inline image from ${filename} (PDF SHA-256 ${sourceHash}), page ${pageNumber}`,license:'Inherited from source PDF; not independently reviewed',verified:false,source_file_sha256:sourceHash,source_parts:[reference],bytes:png};assetsByHash.set(digest,asset);assets.push(asset);
          }
          continue;
        }
        if(op!==OPS.paintImageXObject&&op!==OPS.paintImageXObjectRepeat)continue;
        const inline=false,group=false,placementCount=1,objectId=Array.isArray(args)?args[0]:null;if(typeof objectId!=='string')continue;
        imageCount++;if(imageCount>MAX_IMAGES)throw new Error('PDF image extraction is limited to 100 image placements');
        let image;try{image=page.objs.get(objectId);}catch{try{image=page.commonObjs.get(objectId);}catch{unsupported.add('unresolved-image-object');continue;}}
        if(!image?.data||!Number.isInteger(image.width)||!Number.isInteger(image.height)){unsupported.add('unrecognized-image-object');continue;}
        const raw=Buffer.from(image.data.buffer,image.data.byteOffset,image.data.byteLength);if(raw.length>MAX_IMAGE_BYTES)throw new Error(`Decoded PDF image exceeds 25 MB limit on page ${pageNumber}`);
        const png=pixelsToPng({width:image.width,height:image.height,kind:image.kind,data:raw});totalBytes+=png.length;if(totalBytes>MAX_TOTAL_BYTES)throw new Error('Extracted PDF images exceed 50 MB total');
        const operator=op===OPS.paintInlineImageXObject?'paintInlineImageXObject':group?'paintInlineImageXObjectGroup':op===OPS.paintImageXObject?'paintImageXObject':'paintImageXObjectRepeat';
        const digest=hash(png),reference={page:pageNumber,operator_index:index,operator,...(objectId?{object_id:objectId}:{}),...(group?{placement_count:placementCount}:{}),source_image_sha256:hash(raw)};
        const previous=assetsByHash.get(digest);if(previous){previous.source_parts.push(reference);continue;}
        const imageKind=inline?'inline image':'image XObject',asset={asset_id:`A_PDF_${digest.slice(0,16).toUpperCase()}`,path:`assets/${digest.slice(0,20)}.png`,type:'image/png',mime_type:'image/png',sha256:digest,source:`Decoded ${imageKind} from ${filename} (PDF SHA-256 ${sourceHash}), page ${pageNumber}`,license:'Inherited from source PDF; not independently reviewed',verified:false,source_file_sha256:sourceHash,source_parts:[reference],bytes:png};
        assetsByHash.set(digest,asset);assets.push(asset);
      }
      page.cleanup();
    }
  }finally{await pdf.destroy();}
  if(!assets.length)throw new Error(`No supported PDF inline images or image XObjects were extracted${unsupported.size?`; unsupported content: ${[...unsupported].join(', ')}`:''}`);
  return{source_sha256:sourceHash,assets,unsupported_content:[...unsupported].sort()};
}
