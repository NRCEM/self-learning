import { analysisSchema, type DocumentAnalysis } from './analysis-schema.ts';
import { lessonSchema, lessonFitsContext, type Lesson } from './lesson-schema.ts';
import { readPdfForm } from './pdf-upload.ts';
import { readLanguage, type Language } from './language.ts';
import { AnalysisError } from './analysis-errors.ts';
import { errorText } from './i18n.ts';
export type ContentKind = 'overview' | 'lesson';
function protectedShape(value: unknown): unknown {
 if (Array.isArray(value)) return value.map(protectedShape);
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, ['id','topicId','sourcePages','correctIndex','origin','latex','symbol'].includes(key) ? child : protectedShape(child)]));
 if (typeof value === 'string') return {math:value.match(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g) ?? [],numbers:(value.match(/\d+(?:[.,]\d+)?/g)??[]).sort()};
 return value;
}
export function translationPreserves(source: DocumentAnalysis | Lesson, translated: DocumentAnalysis | Lesson) {
 return JSON.stringify(protectedShape(source)) === JSON.stringify(protectedShape(translated));
}
type Translator = (pdf: Buffer, source: DocumentAnalysis | Lesson, kind: ContentKind, signal: AbortSignal, language: Language) => Promise<unknown>;
export async function handleTranslate(request: Request, translate: Translator) {
 try {
  const {pdf,form,pageCount}=await readPdfForm(request); const language=readLanguage(form);
  const kinds=form.getAll('kind'); const sources=form.getAll('source');
  if(kinds.length!==1 || !['overview','lesson'].includes(String(kinds[0])) || sources.length!==1 || typeof sources[0]!=='string' || Buffer.byteLength(sources[0])>192*1024) throw new AnalysisError(400,'INVALID_TRANSLATION_SOURCE',errorText('en','INVALID_TRANSLATION_SOURCE'));
  const kind=kinds[0] as ContentKind; const schema=kind==='overview'?analysisSchema:lessonSchema;
  let raw:unknown;try{raw=JSON.parse(sources[0]);}catch{throw new AnalysisError(400,'INVALID_TRANSLATION_SOURCE',errorText('en','INVALID_TRANSLATION_SOURCE'));}
  const source=schema.safeParse(raw);
  if(!source.success || (kind==='overview' ? (source.data as DocumentAnalysis).topics.some(t=>t.sourcePages?.some(p=>p>pageCount)) : !lessonFitsContext(source.data as Lesson,(source.data as Lesson).topicId,pageCount))) throw new AnalysisError(400,'INVALID_TRANSLATION_SOURCE',errorText('en','INVALID_TRANSLATION_SOURCE'));
  const result=schema.safeParse(await translate(pdf,source.data,kind,request.signal,language));
  if(!result.success || !translationPreserves(source.data,result.data)) throw new AnalysisError(502,'INVALID_TRANSLATION',errorText('en','INVALID_TRANSLATION'));
  return Response.json({data:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const known=error instanceof AnalysisError?error:new AnalysisError(500,'INTERNAL_ERROR',errorText('en','INTERNAL_ERROR'));return Response.json({error:{code:known.code,message:errorText('en',known.code)}},{status:known.status,headers:{'Cache-Control':'no-store'}});}
}
