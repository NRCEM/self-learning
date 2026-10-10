// Handle formula-only lines even when the model omits delimiters.
export function normalizeMath(text: string) {
 // Some generated expressions use two math closers instead of a right parenthesis.
 const repaired=text.replace(/(\\left\((?:(?!\\right|\\\))[\s\S])*?)\\\)\\\)/g, '$1\\right)\\)');
 return repaired.split('\n').map(line => {
  if (/\\[([]|\$/.test(line) || !/\\[a-zA-Z]+/.test(line)) return line;
  const colon=line.lastIndexOf(':');
  const prefix=colon>=0?line.slice(0,colon+1):'';
  const math=(colon>=0?line.slice(colon+1):line).trim();
  if (!math.startsWith('\\') || /[^\x20-\x7e°]/.test(math)) return line;
  return `${prefix}${prefix?' ':''}\\(${math}\\)`;
 }).join('\n');
}
