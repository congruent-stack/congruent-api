type _JoinSections<A extends string, B extends string> =
  [A] extends [never] ? B : [B] extends [never] ? A : `${A},${B}`;

type _DefinedSection<T, K extends string> =
  Exclude<T, undefined> extends never ? never : K;

type _FailedValidationSectionsImpl<
  P extends string,
  H extends string,
  Q extends string,
  B extends string
> =
  // singles
  | P | H | Q | B
  // pairs
  | _JoinSections<P, H>
  | _JoinSections<P, Q>
  | _JoinSections<P, B>
  | _JoinSections<H, Q>
  | _JoinSections<H, B>
  | _JoinSections<Q, B>
  // triples
  | _JoinSections<_JoinSections<P, H>, Q>
  | _JoinSections<_JoinSections<P, H>, B>
  | _JoinSections<_JoinSections<P, Q>, B>
  | _JoinSections<_JoinSections<H, Q>, B>
  // all four
  | _JoinSections<_JoinSections<_JoinSections<P, H>, Q>, B>;

export type FailedValidationSections<T extends { headers?: any; query?: any; body?: any }> =
  _FailedValidationSectionsImpl<
    'path-segments',
    _DefinedSection<T['headers'], 'headers'>,
    _DefinedSection<T['query'], 'query'>,
    _DefinedSection<T['body'], 'body'>
  >;
