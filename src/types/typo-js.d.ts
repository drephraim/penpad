declare module 'typo-js' {
  class Typo {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(dictionary: string, affData: string, dicData: string, options?: any);
    check(word: string): boolean;
    suggest(word: string): string[];
  }
  export default Typo;
}
