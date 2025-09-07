import { getHelloWorldMessage } from '@congruent-stack/congruent-api';

export function getHelloWorldMessageExpress(name: string): string {
  return getHelloWorldMessage(' [express] ' + name);
}