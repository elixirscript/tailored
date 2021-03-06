import {
  defmatch,
  match,
  match_gen,
  MatchError,
  Clause,
  clause,
  match_or_default,
  match_or_default_gen,
  match_or_default_async,
  defmatchgen,
  defmatchGen,
  defmatchAsync
} from './tailored/defmatch';
import {
  variable,
  wildcard,
  startsWith,
  capture,
  headTail,
  type,
  bound,
  bitStringMatch
} from './tailored/types';

import {
  list_generator,
  list_comprehension,
  bitstring_generator,
  bitstring_comprehension
} from './tailored/comprehensions';

export default {
  defmatch,
  match,
  match_gen,
  MatchError,
  variable,
  wildcard,
  startsWith,
  capture,
  headTail,
  type,
  bound,
  Clause,
  clause,
  bitStringMatch,
  match_or_default,
  match_or_default_gen,
  match_or_default_async,
  defmatchgen,
  list_comprehension,
  list_generator,
  bitstring_generator,
  bitstring_comprehension,
  defmatchGen,
  defmatchAsync
};
