import { buildMatch } from './match';
import * as Types from './types';

const FUNC = Symbol();

export class MatchError extends Error {
  constructor(arg) {
    super();

    if (typeof arg === 'symbol') {
      this.message = 'No match for: ' + arg.toString();
    } else if (Array.isArray(arg)) {
      let mappedValues = arg.map(x => x.toString());
      this.message = 'No match for: ' + mappedValues;
    } else {
      this.message = 'No match for: ' + arg;
    }

    this.stack = new Error().stack;
    this.name = this.constructor.name;
  }
}

export class Clause {
  constructor(pattern, fn, guard = () => true) {
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

export function trampoline(fn) {
  return function() {
    let res = fn.apply(this, arguments);
    while (res instanceof Function) {
      res = res();
    }
    return res;
  };
}

export function defmatch(...clauses) {
  const arities = getArityMap(clauses);

  return function(...args) {
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return funcToCall.apply(this, params);
  };
}

export function defmatchgen(...clauses) {
  const arities = getArityMap(clauses);

  return function*(...args) {
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return yield* funcToCall.apply(this, params);
  };
}

export function defmatchGen(...args) {
  return defmatchgen(...args);
}

export function defmatchAsync(...clauses) {
  const arities = getArityMap(clauses);

  return async function(...args) {
    if (arities.has(args.length)) {
      const arityClauses = arities.get(args.length);

      let funcToCall = null;
      let params = null;
      for (let processedClause of arityClauses) {
        let result = [];
        args = fillInOptionalValues(
          args,
          processedClause.arity,
          processedClause.optionals,
        );

        if (
          processedClause.pattern(args, result) &&
          (await processedClause.guard.apply(this, result))
        ) {
          funcToCall = processedClause.fn;
          params = result;
          break;
        }
      }

      if (!funcToCall) {
        console.error('No match for:', args);
        throw new MatchError(args);
      }

      return funcToCall.apply(this, params);
    } else {
      console.error('Arity of', args.length, 'not found. No match for:', args);
      throw new MatchError(args);
    }
  };
}

function findMatchingFunction(args, arities) {
  if (arities.has(args.length)) {
    const arityClauses = arities.get(args.length);

    let funcToCall = null;
    let params = null;
    for (let processedClause of arityClauses) {
      let result = [];
      args = fillInOptionalValues(
        args,
        processedClause.arity,
        processedClause.optionals,
      );

      if (
        processedClause.pattern(args, result) &&
        processedClause.guard.apply(this, result)
      ) {
        funcToCall = processedClause.fn;
        params = result;
        break;
      }
    }

    if (!funcToCall) {
      console.error('No match for:', args);
      throw new MatchError(args);
    }

    return [funcToCall, params];
  } else {
    console.error('Arity of', args.length, 'not found. No match for:', args);
    throw new MatchError(args);
  }
}

function getArityMap(clauses) {
  let map = new Map();

  for (const clause of clauses) {
    const range = getArityRange(clause);

    for (const arity of range) {
      let arityClauses = [];

      if (map.has(arity)) {
        arityClauses = map.get(arity);
      }

      arityClauses.push(clause);
      map.set(arity, arityClauses);
    }
  }

  return map;
}

function getArityRange(clause) {
  const min = clause.arity - clause.optionals.length;
  const max = clause.arity;

  let range = [min];

  while (range[range.length - 1] != max) {
    range.push(range[range.length - 1] + 1);
  }

  return range;
}

function getOptionalValues(pattern) {
  let optionals = [];

  for (let i = 0; i < pattern.length; i++) {
    if (
      pattern[i] instanceof Types.Variable &&
      pattern[i].default_value != Symbol.for('tailored.no_value')
    ) {
      optionals.push([i, pattern[i].default_value]);
    }
  }

  return optionals;
}

function fillInOptionalValues(args, arity, optionals) {
  if (args.length === arity || optionals.length === 0) {
    return args;
  }

  if (args.length + optionals.length < arity) {
    return args;
  }

  let numberOfOptionalsToFill = arity - args.length;
  let optionalsToRemove = optionals.length - numberOfOptionalsToFill;

  let optionalsToUse = optionals.slice(optionalsToRemove);

  for (let [index, value] of optionalsToUse) {
    args.splice(index, 0, value);
    if (args.length === arity) {
      break;
    }
  }

  return args;
}

export function match(pattern, expr, guard = () => true) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    console.error('No match for:', expr);
    throw new MatchError(expr);
  }
}

export function match_or_default(
  pattern,
  expr,
  guard = () => true,
  default_value = null,
) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    return default_value;
  }
}
