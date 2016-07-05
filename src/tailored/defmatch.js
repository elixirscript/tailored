/* @flow */

import { buildMatch } from "./match";
import * as Types from "./types";

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
    this.arity = pattern.length;
    this.optionals = getOptionalValues(pattern);
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
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        return processedClause.fn.apply(this, result);
      }
    }

    console.error('No match for:', args);
    throw new MatchError(args);
  };
}

export function defmatchgen(...clauses) {
  return function*(...args) {
    for (let processedClause of clauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        return yield* processedClause.fn.apply(this, result);
      }
    }

    console.error('No match for:', args);
    throw new MatchError(args);
  };
}

function getOptionalValues(pattern){
  let optionals = [];

  for(let i = 0; i < pattern.length; i++){
    if(pattern[i] instanceof Types.Variable && pattern[i].default_value != Symbol.for("tailored.no_value")){
      optionals.push([i, pattern[i].default_value]);
    }
  }

  return optionals;
}

function fillInOptionalValues(args, arity, optionals){
  if(args.length === arity || optionals.length === 0){
    return args;
  }

  if(args.length + optionals.length < arity){
    return args;
  }

  let numberOfOptionalsToFill = arity - args.length;
  let optionalsToRemove = optionals.length - numberOfOptionalsToFill;

  let optionalsToUse = optionals.slice(optionalsToRemove);

  for(let [index, value] of optionalsToUse){
    args.splice(index, 0, value);
    if(args.length === arity){
      break;
    }
  }

  return args;
}

export function match(pattern, expr, guard = () => true) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)){
    return result;
  }else{
    console.error('No match for:', expr);
    throw new MatchError(expr);
  }
}

export function match_or_default(pattern, expr, guard = () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)){
    return result;
  }else{
    return default_value;
  }
}
