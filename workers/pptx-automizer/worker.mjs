import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {unzipSync} from 'fflate';
import {inspectPresentationTemplate} from '../../src/templates/import-template.mjs';

const require=createRequire(import.meta.url);const {Automizer,modify}=require('pptx-automizer');
const requestPath=process.argv[2];if(!requestPath)throw new Error('Expected a JSON request file.');
const request=JSON.parse(fs.readFileSync(path.resolve(requestPath),'utf8'));
const input=path.resolve(request.inputFile),output=path.resolve(request.outputFile);
if(request.schema_version!=='1.0.0'||!Number.isInteger(request.slide_number)||request.slide_number<1||typeof request.element_name!=='string'||!request.element_name.trim()||request.element_name.length>200||typeof request.replacement_text!=='string'||!request.replacement_text.trim()||request.replacement_text.length>2000||request.replacement_text.includes('\0'))throw new Error('Invalid PPTX text-edit request.');
if(path.extname(input).toLowerCase()!=='.pptx'||path.extname(output).toLowerCase()!=='.pptx')throw new Error('Automizer supports .pptx input and output only.');
const sourceStat=fs.statSync(input);if(!sourceStat.isFile()||sourceStat.size>100*1024*1024)throw new Error('Input PPTX must be a regular file no larger than 100 MiB.');
if(input===output)throw new Error('Output path must differ from the source PPTX.');
if(fs.existsSync(output))throw new Error('Output PPTX already exists; refusing to overwrite.');
const sourceBytes=fs.readFileSync(input),sourceSha256=crypto.createHash('sha256').update(sourceBytes).digest('hex');
const inventory=inspectPresentationTemplate(input);
const sourceParts=unzipSync(new Uint8Array(sourceBytes)),sourceChartCount=Object.keys(sourceParts).filter(name=>/^ppt\/charts\/chart\d+\.xml$/.test(name)).length;
if(!inventory.package.slide_count||inventory.package.slide_count>100)throw new Error('Input PPTX must contain 1 to 100 slides.');
const templateDir=path.dirname(input),outputDir=path.dirname(output),inputName=path.basename(input),templateName='source-template';
const automizer=new Automizer({templateDir,outputDir,removeExistingSlides:true,autoImportSlideMasters:true,cleanup:true,verbosity:0});
automizer.loadRoot(inputName).load(inputName,templateName);
const info=await automizer.getInfo(),slides=info.slidesByTemplate(templateName);
if(slides.length!==inventory.package.slide_count)throw new Error('pptx-automizer and OOXML slide counts disagree.');
const page=slides.find(slide=>slide.number===request.slide_number);
const element=info.elementByName(templateName,request.slide_number,request.element_name);
if(!page||!element)throw new Error('Requested slide or exact element name was not found.');
if(element.type!=='sp'||!element.hasTextBody)throw new Error('Target must be an editable PowerPoint text shape (type sp).');
for(const slide of slides){
  automizer.addSlide(templateName,slide.number,target=>{
    if(slide.number===request.slide_number)target.modifyElement(request.element_name,modify.setText(request.replacement_text));
  });
}
const summary=await automizer.write(path.basename(output));
if(!fs.existsSync(output))throw new Error('pptx-automizer did not create the requested output.');
if(crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex')!==sourceSha256)throw new Error('Source PPTX changed during processing.');
const outputInventory=inspectPresentationTemplate(output);
if(outputInventory.package.slide_count!==inventory.package.slide_count)throw new Error('Output slide count changed.');
const outputParts=unzipSync(new Uint8Array(fs.readFileSync(output))),outputChartCount=Object.keys(outputParts).filter(name=>/^ppt\/charts\/chart\d+\.xml$/.test(name)).length;
if(outputChartCount!==sourceChartCount)throw new Error('Native chart package parts changed.');
const manifest={schema_version:'1.0.0',adapter:'pptx-automizer',version:require('pptx-automizer/package.json').version,input:{name:path.basename(input),sha256:sourceSha256},output:{name:path.basename(output),sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')},operation:{type:'replace-text-shape',slide_number:request.slide_number,element_name:request.element_name,replacement_text_sha256:crypto.createHash('sha256').update(request.replacement_text).digest('hex')},summary:{slide_count:outputInventory.package.slide_count,native_chart_count:outputChartCount,master_count:outputInventory.package.slide_master_count},warnings:['pptx-automizer documents limitations for animations, video/audio, and some special relationships; inspect exported output in the target presentation application.','Untouched-page render fidelity is established only for the tested fixture and renderer.']};
const manifestPath=`${output}.automizer.json`;fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ok:true,output,manifestPath,summary:manifest.summary,source_unchanged:true},null,2));
