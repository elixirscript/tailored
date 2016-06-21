/* @flow */

import { buildMatch } from "./match";

export class MatchError extends Error {
  constructor(arg) {
    super();

    if(typeof arg === 'symbol'){
      this.message = 'No match for: ' + arg.toString();
    } else if(Array.isArray(arg)){
      let mappedValues = arg.map((x) => x.toString());
      this.message = 'No match for: ' + mappedValues;
    }else{
      this.message = 'No match for: ' + arg;
    }

    this.stack = (new Error()).stack;
    this.name = this.constructor.name;
  }
}


export class Clause {
  constructor(pattern, fn, guard = () => true){
    this.pattern = buildMatch(pattern);
    this.fn = fn;
    this.guard = guard;
  }
}

export function clause(pattern, fn, guard = () => true) {
  return new Clause(pattern, fn, guard);
}

export function defmatch(...clauses) {
  return function(...args) {
    for (let processedClause of clauses) {
      let result = [];
      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        return processedClause.fn.apply(this, result);
      }
    }

    throw new MatchError(args);
  };
}

export function match(pattern, expr, guard = () => true) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)){
    return result;
  }else{
    throw new MatchError(expr);
  }
}
