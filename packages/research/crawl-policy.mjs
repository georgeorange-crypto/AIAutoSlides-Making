import dns from 'node:dns/promises';
import net from 'node:net';

function ipv4Number(ip){return ip.split('.').reduce((n,part)=>(n<<8n)|BigInt(Number(part)),0n);}
function ipv4InCidr(ip,cidr){const [base,prefixRaw]=cidr.split('/');if(net.isIP(ip)!==4||net.isIP(base)!==4)return false;const prefix=Number(prefixRaw);if(!Number.isInteger(prefix)||prefix<0||prefix>32)return false;const shift=BigInt(32-prefix),mask=prefix===0?0n:((0xffffffffn<<shift)&0xffffffffn);return(ipv4Number(ip)&mask)===(ipv4Number(base)&mask);}
const RESERVED_V4=['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24','192.88.99.0/24','192.168.0.0/16','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/4','240.0.0.0/4'];
function validatePublicIPv4(ip){return !RESERVED_V4.some(cidr=>ipv4InCidr(ip,cidr));}
function validatePublicIPv6(ip){const lower=ip.toLowerCase();return (lower.startsWith('2')||lower.startsWith('3'))&&!lower.startsWith('2001:db8:')&&!lower.startsWith('::ffff:');}

export async function assertPublicHttps(raw,{lookup=dns.lookup,egressCidrs=process.env.AIAUTOSLIDES_EGRESS_CIDRS||''}={}){
 let url;try{url=new URL(raw);}catch{throw new Error('URL must be a valid absolute HTTPS URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw new Error('Only HTTPS URLs without credentials or custom ports are accepted');
 const host=url.hostname.toLowerCase().replace(/\.$/,''),bare=host.startsWith('[')&&host.endsWith(']')?host.slice(1,-1):host;
 if(bare==='localhost'||bare.endsWith('.localhost')||bare.endsWith('.local'))throw new Error('Local/private hostnames are not crawlable');
 const answers=net.isIP(bare)?[{address:bare}]:await lookup(bare,{all:true,verbatim:true});if(!answers.length)throw new Error('URL host did not resolve');
 const trustedEgress=egressCidrs.split(',').map(s=>s.trim()).filter(Boolean);let mappedEgress=false;
 for(const {address}of answers){const family=net.isIP(address),publicAddress=family===4?validatePublicIPv4(address):family===6?validatePublicIPv6(address):false;if(!publicAddress){const explicitlyMapped=family===4&&trustedEgress.some(cidr=>ipv4InCidr(address,cidr));if(!explicitlyMapped)throw new Error(`URL resolves to a non-public address (${address}); set AIAUTOSLIDES_EGRESS_CIDRS only for a documented outbound gateway range`);mappedEgress=true;}}
 return{url,mappedEgress};
}

export function validateSameHostRedirect(requested,final){if(requested.hostname!==final.hostname)throw new Error('Crawl redirected to a different host; refusing to keep cross-host output');return final;}
