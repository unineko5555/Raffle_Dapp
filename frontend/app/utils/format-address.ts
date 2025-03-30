/**
 * アドレスを表示用に省略フォーマットする関数
 * @param address イーサリアムアドレス
 * @param prefixLength 表示する先頭の文字数
 * @param suffixLength 表示する末尾の文字数
 * @returns フォーマットされたアドレス（例: 0x1234...5678）
 */
export function formatAddress(address: string | undefined, prefixLength: number = 6, suffixLength: number = 4): string {
  if (!address) return '';
  
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}
