import { z } from 'zod';
import { AnalysisError } from './analysis-errors.ts';
export const languageSchema=z.enum(['en','vi']);
export type Language=z.infer<typeof languageSchema>;
export function readLanguage(form:FormData):Language{
 const values=form.getAll('language');
 const parsed=languageSchema.safeParse(values.length?values.length===1?values[0]:null:'en');
 if(!parsed.success)throw new AnalysisError(400,'INVALID_LANGUAGE','Choose English or Vietnamese.');
 return parsed.data;
}
export const languageName=(language:Language)=>language==='vi'?'Vietnamese with full, correct diacritics':'English';
