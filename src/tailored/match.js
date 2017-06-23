import * as Resolvers from './resolvers';
import {
  Variable,
  Wildcard,
  HeadTail,
  Capture,
  Type,
  StartsWith,
  Bound,
  BitStringMatch,
} from './types';

const patternMap = new Map();
patternMap.set(Variable.prototype, Resolvers.resolveVariable);
patternMap.set(Wildcard.prototype, Resolvers.resolveWildcard);
patternMap.set(HeadTail.prototype, Resolvers.resolveHeadTail);
patternMap.set(StartsWith.prototype, Resolvers.resolveStartsWith);
patternMap.set(Capture.prototype, Resolvers.resolveCapture);
patternMap.set(Bound.prototype, Resolvers.resolveBound);
patternMap.set(Type.prototype, Resolvers.resolveType);
patternMap.set(BitStringMatch.prototype, Resolvers.resolveBitString);
patternMap.set(Number.prototype, Resolvers.resolveNumber);
patternMap.set(Symbol.prototype, Resolvers.resolveSymbol);
patternMap.set(Array.prototype, Resolvers.resolveArray);
patternMap.set(String.prototype, Resolvers.resolveString);
patternMap.set(Boolean.prototype, Resolvers.resolveBoolean);
patternMap.set(Function.prototype, Resolvers.resolveFunction);
patternMap.set(Object.prototype, Resolvers.resolveObject);

export function buildMatch(pattern) {
  if (pattern === null) {
    return Resolvers.resolveNull(pattern);
  }

  if (typeof pattern === 'undefined') {
    return Resolvers.resolveWildcard(pattern);
  }

  const type = pattern.constructor.prototype;
  const resolver = patternMap.get(type);

  if (resolver) {
    return resolver(pattern);
  }

  if (typeof pattern === 'object') {
    return Resolvers.resolveObject(pattern);
  }

  return Resolvers.resolveNoMatch();
}
