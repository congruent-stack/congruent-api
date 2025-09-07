import { getHelloWorldMessage } from '@congruent-stack/congruent-api';

export function getHelloWorldMessageFetch(name: string): string {
  return getHelloWorldMessage(' [fetch] ' + name);
}