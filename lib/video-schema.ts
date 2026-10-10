import { languageSchema } from './language.ts';
import { z } from 'zod';
export const videoSearchSchema = z.strictObject({
 language:languageSchema.default('en'),
 topicId:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(200),
 subject:z.string().trim().min(1).max(200),concepts:z.array(z.string().trim().min(1).max(160)).max(5),
});
const thumbnail=z.string().url().refine(value=>{const u=new URL(value);return u.protocol==='https:' && ['i.ytimg.com','img.youtube.com'].includes(u.hostname);},'Invalid YouTube thumbnail');
export const videoSchema=z.strictObject({id:z.string().regex(/^[\w-]{11}$/),title:z.string().trim().min(1).max(1000),channel:z.string().trim().min(1).max(300),language:z.string().max(80).nullable().optional(),thumbnail});
export const videoResultSchema=z.strictObject({topicId:z.string().min(1).max(80),videos:z.array(videoSchema).max(3)}).refine(data=>new Set(data.videos.map(v=>v.id)).size===data.videos.length);
export type VideoSearch=z.infer<typeof videoSearchSchema>;
export type VideoResult=z.infer<typeof videoResultSchema>;
export function buildVideoQuery(input:VideoSearch) {
 const clean=(s:string)=>s.replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 const core=clean(`${input.name} ${input.subject}`);
 const seen=new Set(core.toLocaleLowerCase().split(' '));
 const stop=new Set('the and of in to for with from this that an a is are learning lesson introduction các những về của và với trong khi qua từ cho một được có là để tính toán bài tập tìm hiểu áp dụng ứng dụng giải thích hiện tượng sử dụng dựa trên theo độ sự'.split(' '));
 const keywords=clean(input.concepts.join(' ')).split(' ').filter(word=>{const lower=word.toLocaleLowerCase();if(word.length<2||stop.has(lower)||seen.has(lower))return false;seen.add(lower);return true;}).slice(0,6);
 return `${core} ${keywords.join(' ')}`.trim().slice(0,400);
}
// YouTube snippets may HTML-encode titles. Decode text only; never render it as HTML.
export function decodeVideoText(value:string) {
 const named:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
 return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(entity,body:string)=>{
  if(!body.startsWith('#'))return named[body.toLowerCase()]??entity;
  const point=body[1].toLowerCase()==='x'?parseInt(body.slice(2),16):parseInt(body.slice(1),10);
  return point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):entity;
 });
}
