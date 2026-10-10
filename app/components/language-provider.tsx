'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {languageSchema,type Language} from '@/lib/language';
import {translator,errorText} from '@/lib/i18n';
const LanguageContext=createContext<{language:Language;setLanguage:(language:Language)=>void;t:ReturnType<typeof translator>;error:(code:string)=>string}|null>(null);
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setValue]=useState<Language>('en');
 useEffect(()=>{try{const saved=languageSchema.safeParse(localStorage.getItem('self-learning.language'));if(saved.success)setValue(saved.data);}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=language;},[language]);
 function setLanguage(value:Language){setValue(value);try{localStorage.setItem('self-learning.language',value);}catch{}}
 return <LanguageContext.Provider value={{language,setLanguage,t:translator(language),error:code=>errorText(language,code)}}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){const context=useContext(LanguageContext);if(!context)throw Error('LanguageProvider is required.');return context;}
export function LanguageSelector(){const {language,setLanguage,t}=useLanguage();return <label className="language-picker"><span>{t('language')}</span><select aria-label={t('language')} value={language} onChange={e=>{const value=languageSchema.safeParse(e.target.value);if(value.success)setLanguage(value.data);}}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>;}
