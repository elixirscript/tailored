'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ErlangTypes = _interopDefault(require('erlang-types'));

/* @flow */

class Variable {
  constructor(name = null, default_value = Symbol.for('tailored.no_value')) {
    this.name = name;
    this.default_value = default_value;
  }
}

class Wildcard {
  constructor() {}
}

class StartsWith {
  constructor(prefix) {
    this.prefix = prefix;
  }
}

class Capture {
  constructor(value) {
    this.value = value;
  }
}

class HeadTail {
  constructor(head, tail) {
    this.head = head;
    this.tail = tail;
  }
}

class Type {
  constructor(type, objPattern = {}) {
    this.type = type;
    this.objPattern = objPattern;
  }
}

class Bound {
  constructor(value) {
    this.value = value;
  }
}

class BitStringMatch {
  constructor(...values) {
    this.values = values;
  }

  length() {
    return values.length;
  }

  bit_size() {
    return this.byte_size() * 8;
  }

  byte_size() {
    let s = 0;

    for (let val of this.values) {
      s = s + val.unit * val.size / 8;
    }

    return s;
  }

  getValue(index) {
    return this.values(index);
  }

  getSizeOfValue(index) {
    let val = this.getValue(index);
    return val.unit * val.size;
  }

  getTypeOfValue(index) {
    return this.getValue(index).type;
  }
}

class NamedVariableResult {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
}

function variable(name = null, default_value = Symbol.for('tailored.no_value')) {
  return new Variable(name, default_value);
}

function wildcard() {
  return new Wildcard();
}

function startsWith(prefix) {
  return new StartsWith(prefix);
}

function capture(value) {
  return new Capture(value);
}

function headTail(head, tail) {
  return new HeadTail(head, tail);
}

function type(type, objPattern = {}) {
  return new Type(type, objPattern);
}

function bound(value) {
  return new Bound(value);
}

function bitStringMatch(...values) {
  return new BitStringMatch(...values);
}

function namedVariableResult(name, value) {
  return new NamedVariableResult(name, value);
}

/* @flow */

function is_number(value) {
  return typeof value === 'number';
}

function is_string(value) {
  return typeof value === 'string';
}

function is_boolean(value) {
  return typeof value === 'boolean';
}

function is_symbol(value) {
  return typeof value === 'symbol';
}

function is_object(value) {
  return typeof value === 'object';
}

function is_variable(value) {
  return value instanceof Variable;
}

function is_null(value) {
  return value === null;
}

function is_array(value) {
  return Array.isArray(value);
}

function is_function(value) {
  return typeof value === 'function' || value instanceof Function;
}

function is_map(value) {
  return value instanceof Map;
}

/* @flow */

const BitString = ErlangTypes.BitString;

function resolveSymbol(pattern) {
  return function (value) {
    return is_symbol(value) && value === pattern;
  };
}

function resolveString(pattern) {
  return function (value) {
    return is_string(value) && value === pattern;
  };
}

function resolveNumber(pattern) {
  return function (value) {
    return is_number(value) && value === pattern;
  };
}

function resolveBoolean(pattern) {
  return function (value) {
    return is_boolean(value) && value === pattern;
  };
}

function resolveFunction(pattern) {
  return function (value) {
    return is_function(value) && value === pattern;
  };
}

function resolveNull(pattern) {
  return function (value) {
    return is_null(value);
  };
}

function resolveBound(pattern) {
  return function (value, args) {
    if (typeof value === typeof pattern.value && value === pattern.value) {
      return true;
    }

    return false;
  };
}

function resolveWildcard() {
  return function () {
    return true;
  };
}

function resolveVariable(pattern) {
  return function (value, args) {
    if (pattern.name === null) {
      args.push(value);
    } else if (!pattern.name.startsWith('_')) {
      args.push(namedVariableResult(pattern.name, value));
    }

    return true;
  };
}

function resolveHeadTail(pattern) {
  const headMatches = buildMatch(pattern.head);
  const tailMatches = buildMatch(pattern.tail);

  return function (value, args) {
    if (!is_array(value) || value.length === 0) {
      return false;
    }

    const head = value[0];
    const tail = value.slice(1);

    if (headMatches(head, args) && tailMatches(tail, args)) {
      return true;
    }

    return false;
  };
}

function resolveCapture(pattern) {
  const matches = buildMatch(pattern.value);

  return function (value, args) {
    if (matches(value, args)) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveStartsWith(pattern) {
  const prefix = pattern.prefix;

  return function (value, args) {
    if (is_string(value) && value.startsWith(prefix)) {
      args.push(value.substring(prefix.length));
      return true;
    }

    return false;
  };
}

function resolveType(pattern) {
  return function (value, args) {
    if (value instanceof pattern.type) {
      const matches = buildMatch(pattern.objPattern);
      return matches(value, args);
    }

    return false;
  };
}

function resolveArray(pattern) {
  const matches = pattern.map(x => buildMatch(x));

  return function (value, args) {
    if (!is_array(value) || value.length != pattern.length) {
      return false;
    }

    return value.every(function (v, i) {
      return matches[i](value[i], args);
    });
  };
}

function resolveMap(pattern) {
  let matches = new Map();

  const keys = Array.from(pattern.keys());

  for (let key of keys) {
    matches.set(key, buildMatch(pattern.get(key)));
  }

  return function (value, args) {
    if (!is_map(value) || pattern.size > value.size) {
      return false;
    }

    for (let key of keys) {
      if (!value.has(key) || !matches.get(key)(value.get(key), args)) {
        return false;
      }
    }

    return true;
  };
}

function resolveObject(pattern) {
  let matches = {};

  const keys = Object.keys(pattern).concat(Object.getOwnPropertySymbols(pattern));

  for (let key of keys) {
    matches[key] = buildMatch(pattern[key]);
  }

  return function (value, args) {
    if (!is_object(value) || pattern.length > value.length) {
      return false;
    }

    for (let key of keys) {
      if (!(key in value) || !matches[key](value[key], args)) {
        return false;
      }
    }

    return true;
  };
}

function resolveBitString(pattern) {
  let patternBitString = [];

  for (let bitstringMatchPart of pattern.values) {
    if (is_variable(bitstringMatchPart.value)) {
      let size = getSize(bitstringMatchPart.unit, bitstringMatchPart.size);
      fillArray(patternBitString, size);
    } else {
      patternBitString = patternBitString.concat(new BitString(bitstringMatchPart).value);
    }
  }

  let patternValues = pattern.values;

  return function (value, args) {
    let bsValue = null;

    if (!is_string(value) && !(value instanceof BitString)) {
      return false;
    }

    if (is_string(value)) {
      bsValue = new BitString(BitString.binary(value));
    } else {
      bsValue = value;
    }

    let beginningIndex = 0;

    for (let i = 0; i < patternValues.length; i++) {
      let bitstringMatchPart = patternValues[i];

      if (is_variable(bitstringMatchPart.value) && bitstringMatchPart.type == 'binary' && bitstringMatchPart.size === undefined && i < patternValues.length - 1) {
        throw new Error('a binary field without size is only allowed at the end of a binary pattern');
      }

      let size = 0;
      let bsValueArrayPart = [];
      let patternBitStringArrayPart = [];
      size = getSize(bitstringMatchPart.unit, bitstringMatchPart.size);

      if (i === patternValues.length - 1) {
        bsValueArrayPart = bsValue.value.slice(beginningIndex);
        patternBitStringArrayPart = patternBitString.slice(beginningIndex);
      } else {
        bsValueArrayPart = bsValue.value.slice(beginningIndex, beginningIndex + size);
        patternBitStringArrayPart = patternBitString.slice(beginningIndex, beginningIndex + size);
      }

      if (is_variable(bitstringMatchPart.value)) {
        switch (bitstringMatchPart.type) {
          case 'integer':
            if (bitstringMatchPart.attributes && bitstringMatchPart.attributes.indexOf('signed') != -1) {
              args.push(new Int8Array([bsValueArrayPart[0]])[0]);
            } else {
              args.push(new Uint8Array([bsValueArrayPart[0]])[0]);
            }
            break;

          case 'float':
            if (size === 64) {
              args.push(Float64Array.from(bsValueArrayPart)[0]);
            } else if (size === 32) {
              args.push(Float32Array.from(bsValueArrayPart)[0]);
            } else {
              return false;
            }
            break;

          case 'bitstring':
            args.push(createBitString(bsValueArrayPart));
            break;

          case 'binary':
            args.push(String.fromCharCode.apply(null, new Uint8Array(bsValueArrayPart)));
            break;

          case 'utf8':
            args.push(String.fromCharCode.apply(null, new Uint8Array(bsValueArrayPart)));
            break;

          case 'utf16':
            args.push(String.fromCharCode.apply(null, new Uint16Array(bsValueArrayPart)));
            break;

          case 'utf32':
            args.push(String.fromCharCode.apply(null, new Uint32Array(bsValueArrayPart)));
            break;

          default:
            return false;
        }
      } else if (!arraysEqual(bsValueArrayPart, patternBitStringArrayPart)) {
        return false;
      }

      beginningIndex = beginningIndex + size;
    }

    return true;
  };
}

function getSize(unit, size) {
  return unit * size / 8;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

function fillArray(arr, num) {
  for (let i = 0; i < num; i++) {
    arr.push(0);
  }
}

function createBitString(arr) {
  let integerParts = arr.map(elem => BitString.integer(elem));
  return new BitString(...integerParts);
}

function resolveNoMatch() {
  return function () {
    return false;
  };
}

const patternMap = new Map();
patternMap.set(Variable.prototype, resolveVariable);
patternMap.set(Wildcard.prototype, resolveWildcard);
patternMap.set(HeadTail.prototype, resolveHeadTail);
patternMap.set(StartsWith.prototype, resolveStartsWith);
patternMap.set(Capture.prototype, resolveCapture);
patternMap.set(Bound.prototype, resolveBound);
patternMap.set(Type.prototype, resolveType);
patternMap.set(BitStringMatch.prototype, resolveBitString);
patternMap.set(Number.prototype, resolveNumber);
patternMap.set(Symbol.prototype, resolveSymbol);
patternMap.set(Map.prototype, resolveMap);
patternMap.set(Array.prototype, resolveArray);
patternMap.set(String.prototype, resolveString);
patternMap.set(Boolean.prototype, resolveBoolean);
patternMap.set(Function.prototype, resolveFunction);
patternMap.set(Object.prototype, resolveObject);

function buildMatch(pattern) {
  if (pattern === null) {
    return resolveNull(pattern);
  }

  if (typeof pattern === 'undefined') {
    return resolveWildcard(pattern);
  }

  if (typeof pattern === 'function') {
    return resolveFunction(pattern);
  }

  const type$$1 = pattern.constructor.prototype;
  const resolver = patternMap.get(type$$1);

  if (resolver) {
    return resolver(pattern);
  }

  if (typeof pattern === 'object') {
    return resolveObject(pattern);
  }

  return resolveNoMatch();
}

class MatchError extends Error {
  constructor(arg) {
    super();

    if (typeof arg === 'symbol') {
      this.message = 'No match for: ' + arg.toString();
    } else if (Array.isArray(arg)) {
      let mappedValues = arg.map(x => {
        if (x === null) {
          return 'null';
        } else if (typeof x === 'undefined') {
          return 'undefined';
        }

        return x.toString();
      });

      this.message = 'No match for: ' + mappedValues;
    } else {
      this.message = 'No match for: ' + arg;
    }

    this.name = this.constructor.name;
  }
}

class Clause {
  constructor(pattern, fn, guard = () => true) {
    this.pattern = buildMatch(pattern);
    this.arity = pattern.length;
    this.optionals = getOptionalValues(pattern);
    this.fn = fn;
    this.guard = guard;
  }
}

function clause(pattern, fn, guard = () => true) {
  return new Clause(pattern, fn, guard);
}



function defmatch(...clauses) {
  const arities = getArityMap(clauses);

  return function (...args) {
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return funcToCall.apply(this, params);
  };
}

function defmatchgen(...clauses) {
  const arities = getArityMap(clauses);

  return function* (...args) {
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return yield* funcToCall.apply(this, params);
  };
}

function defmatchGen(...args) {
  return defmatchgen(...args);
}

function defmatchAsync(...clauses) {
  const arities = getArityMap(clauses);

  return async function (...args) {
    if (arities.has(args.length)) {
      const arityClauses = arities.get(args.length);

      let funcToCall = null;
      let params = null;
      for (let processedClause of arityClauses) {
        let result = [];
        args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

        const doesMatch = processedClause.pattern(args, result);
        const [filteredResult, allNamesMatch] = checkNamedVariables(result);

        if (doesMatch && allNamesMatch && (await processedClause.guard.apply(this, filteredResult))) {
          funcToCall = processedClause.fn;
          params = filteredResult;
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
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      const doesMatch = processedClause.pattern(args, result);
      const [filteredResult, allNamesMatch] = checkNamedVariables(result);

      if (doesMatch && allNamesMatch && processedClause.guard.apply(this, filteredResult)) {
        funcToCall = processedClause.fn;
        params = filteredResult;
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
    if (pattern[i] instanceof Variable && pattern[i].default_value != Symbol.for('tailored.no_value')) {
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

function match(pattern, expr, guard = () => true) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);

  if (doesMatch && allNamesMatch && guard.apply(this, filteredResult)) {
    return filteredResult;
  } else {
    console.error('No match for:', expr);
    throw new MatchError(expr);
  }
}

function checkNamedVariables(results) {
  const namesMap = {};
  const filteredResults = [];

  for (let i = 0; i < results.length; i++) {
    const current = results[i];
    if (current instanceof NamedVariableResult) {
      if (namesMap[current.name] && namesMap[current.name] !== current.value) {
        return [results, false];
      } else if (namesMap[current.name] && namesMap[current.name] === current.value) {
        filteredResults.push(current.value);
      } else {
        namesMap[current.name] = current.value;
        filteredResults.push(current.value);
      }
    } else {
      filteredResults.push(current);
    }
  }

  return [filteredResults, true];
}

function match_or_default(pattern, expr, guard = () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);

  if (doesMatch && allNamesMatch && guard.apply(this, filteredResult)) {
    return filteredResult;
  } else {
    return default_value;
  }
}

async function match_or_default_async(pattern, expr, guard = async () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  const doesMatch = processedPattern(expr, result);
  const [filteredResult, allNamesMatch] = checkNamedVariables(result);
  const matches = doesMatch && allNamesMatch;

  if (matches && (await guard.apply(this, filteredResult))) {
    return filteredResult;
  } else {
    return default_value;
  }
}

const NO_MATCH = Symbol();

function bitstring_generator(pattern, bitstring) {
  return function () {
    let returnResult = [];
    let bsSlice = bitstring.slice(0, pattern.byte_size());
    let i = 1;

    while (bsSlice.byte_size == pattern.byte_size()) {
      const result = match_or_default(pattern, bsSlice, () => true, NO_MATCH);

      if (result != NO_MATCH) {
        const [value] = result;
        returnResult.push(result);
      }

      bsSlice = bitstring.slice(pattern.byte_size() * i, pattern.byte_size() * (i + 1));

      i++;
    }

    return returnResult;
  };
}

function list_generator(pattern, list) {
  return function () {
    let returnResult = [];
    for (let i of list) {
      const result = match_or_default(pattern, i, () => true, NO_MATCH);
      if (result != NO_MATCH) {
        const [value] = result;
        returnResult.push(value);
      }
    }

    return returnResult;
  };
}

function list_comprehension(expression, generators) {
  const generatedValues = run_generators(generators.pop()(), generators);

  let result = [];

  for (let value of generatedValues) {
    if (expression.guard.apply(this, value)) {
      result.push(expression.fn.apply(this, value));
    }
  }

  return result;
}

function run_generators(generator, generators) {
  if (generators.length == 0) {
    return generator.map(x => {
      if (Array.isArray(x)) {
        return x;
      } else {
        return [x];
      }
    });
  } else {
    const list = generators.pop();

    let next_gen = [];
    for (let j of list()) {
      for (let i of generator) {
        next_gen.push([j].concat(i));
      }
    }

    return run_generators(next_gen, generators);
  }
}

function bitstring_comprehension(expression, generators) {
  const generatedValues = run_generators(generators.pop()(), generators);

  let result = [];

  for (let value of generatedValues) {
    if (expression.guard.apply(this, value)) {
      result.push(expression.fn.apply(this, value));
    }
  }

  result = result.map(x => ErlangTypes.BitString.integer(x));
  return new ErlangTypes.BitString(...result);
}

var index = {
  defmatch,
  match,
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
  match_or_default_async,
  defmatchgen,
  list_comprehension,
  list_generator,
  bitstring_generator,
  bitstring_comprehension,
  defmatchGen,
  defmatchAsync
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoaGVhZCwgdGFpbCkge1xuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgfVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKGhlYWQsIHRhaWwpIHtcbiAgcmV0dXJuIG5ldyBIZWFkVGFpbChoZWFkLCB0YWlsKTtcbn1cblxuZnVuY3Rpb24gdHlwZSh0eXBlLCBvYmpQYXR0ZXJuID0ge30pIHtcbiAgcmV0dXJuIG5ldyBUeXBlKHR5cGUsIG9ialBhdHRlcm4pO1xufVxuXG5mdW5jdGlvbiBib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gbmV3IEJvdW5kKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gYml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKSB7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gbmFtZWRWYXJpYWJsZVJlc3VsdChuYW1lLCB2YWx1ZSkge1xuICByZXR1cm4gbmV3IE5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpO1xufVxuXG5leHBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIFN0YXJ0c1dpdGgsXG4gIENhcHR1cmUsXG4gIEhlYWRUYWlsLFxuICBUeXBlLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgTmFtZWRWYXJpYWJsZVJlc3VsdCxcbiAgbmFtZWRWYXJpYWJsZVJlc3VsdFxufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3R5cGVzJztcblxuZnVuY3Rpb24gaXNfbnVtYmVyKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc19zdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG5cbmZ1bmN0aW9uIGlzX2Jvb2xlYW4odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nO1xufVxuXG5mdW5jdGlvbiBpc19zeW1ib2wodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCc7XG59XG5cbmZ1bmN0aW9uIGlzX3VuZGVmaW5lZCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJztcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfYml0c3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJpdFN0cmluZ01hdGNoO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfYXJyYXkodmFsdWUpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nIHx8IHZhbHVlIGluc3RhbmNlb2YgRnVuY3Rpb247XG59XG5cbmZ1bmN0aW9uIGlzX21hcCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBNYXA7XG59XG5cbmV4cG9ydCB7XG4gIGlzX251bWJlcixcbiAgaXNfc3RyaW5nLFxuICBpc19ib29sZWFuLFxuICBpc19zeW1ib2wsXG4gIGlzX251bGwsXG4gIGlzX3VuZGVmaW5lZCxcbiAgaXNfZnVuY3Rpb24sXG4gIGlzX3ZhcmlhYmxlLFxuICBpc193aWxkY2FyZCxcbiAgaXNfaGVhZFRhaWwsXG4gIGlzX2NhcHR1cmUsXG4gIGlzX3R5cGUsXG4gIGlzX3N0YXJ0c1dpdGgsXG4gIGlzX2JvdW5kLFxuICBpc19vYmplY3QsXG4gIGlzX2FycmF5LFxuICBpc19iaXRzdHJpbmcsXG4gIGlzX21hcFxufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tICcuL2NoZWNrcyc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tICcuL21hdGNoJztcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tICdlcmxhbmctdHlwZXMnO1xuY29uc3QgQml0U3RyaW5nID0gRXJsYW5nVHlwZXMuQml0U3RyaW5nO1xuXG5mdW5jdGlvbiByZXNvbHZlU3ltYm9sKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zeW1ib2wodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RyaW5nKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTnVtYmVyKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udW1iZXIodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQm9vbGVhbihwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfYm9vbGVhbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfZnVuY3Rpb24odmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTnVsbChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfbnVsbCh2YWx1ZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb3VuZChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IHR5cGVvZiBwYXR0ZXJuLnZhbHVlICYmIHZhbHVlID09PSBwYXR0ZXJuLnZhbHVlKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVXaWxkY2FyZCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVmFyaWFibGUocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAocGF0dGVybi5uYW1lID09PSBudWxsKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoIXBhdHRlcm4ubmFtZS5zdGFydHNXaXRoKCdfJykpIHtcbiAgICAgIGFyZ3MucHVzaChUeXBlcy5uYW1lZFZhcmlhYmxlUmVzdWx0KHBhdHRlcm4ubmFtZSwgdmFsdWUpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKHBhdHRlcm4pIHtcbiAgY29uc3QgaGVhZE1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4uaGVhZCk7XG4gIGNvbnN0IHRhaWxNYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLnRhaWwpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgaWYgKGhlYWRNYXRjaGVzKGhlYWQsIGFyZ3MpICYmIHRhaWxNYXRjaGVzKHRhaWwsIGFyZ3MpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVDYXB0dXJlKHBhdHRlcm4pIHtcbiAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi52YWx1ZSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKG1hdGNoZXModmFsdWUsIGFyZ3MpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKSB7XG4gIGNvbnN0IHByZWZpeCA9IHBhdHRlcm4ucHJlZml4O1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZS5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHBhdHRlcm4udHlwZSkge1xuICAgICAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi5vYmpQYXR0ZXJuKTtcbiAgICAgIHJldHVybiBtYXRjaGVzKHZhbHVlLCBhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVBcnJheShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBwYXR0ZXJuLm1hcCh4ID0+IGJ1aWxkTWF0Y2goeCkpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWUuZXZlcnkoZnVuY3Rpb24odiwgaSkge1xuICAgICAgcmV0dXJuIG1hdGNoZXNbaV0odmFsdWVbaV0sIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTWFwKHBhdHRlcm4pIHtcbiAgbGV0IG1hdGNoZXMgPSBuZXcgTWFwKCk7XG5cbiAgY29uc3Qga2V5cyA9IEFycmF5LmZyb20ocGF0dGVybi5rZXlzKCkpO1xuXG4gIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgbWF0Y2hlcy5zZXQoa2V5LCBidWlsZE1hdGNoKHBhdHRlcm4uZ2V0KGtleSkpKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX21hcCh2YWx1ZSkgfHwgcGF0dGVybi5zaXplID4gdmFsdWUuc2l6ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgICBpZiAoIXZhbHVlLmhhcyhrZXkpIHx8ICFtYXRjaGVzLmdldChrZXkpKHZhbHVlLmdldChrZXkpLCBhcmdzKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoXG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKVxuICApO1xuXG4gIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfb2JqZWN0KHZhbHVlKSB8fCBwYXR0ZXJuLmxlbmd0aCA+IHZhbHVlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgICBpZiAoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IgKGxldCBiaXRzdHJpbmdNYXRjaFBhcnQgb2YgcGF0dGVybi52YWx1ZXMpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpIHtcbiAgICAgIGxldCBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuICAgICAgZmlsbEFycmF5KHBhdHRlcm5CaXRTdHJpbmcsIHNpemUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQoXG4gICAgICAgIG5ldyBCaXRTdHJpbmcoYml0c3RyaW5nTWF0Y2hQYXJ0KS52YWx1ZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmICghQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgISh2YWx1ZSBpbnN0YW5jZW9mIEJpdFN0cmluZykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkpIHtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnNWYWx1ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGxldCBiZWdpbm5pbmdJbmRleCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBiaXRzdHJpbmdNYXRjaFBhcnQgPSBwYXR0ZXJuVmFsdWVzW2ldO1xuXG4gICAgICBpZiAoXG4gICAgICAgIENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC50eXBlID09ICdiaW5hcnknICYmXG4gICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5zaXplID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnYSBiaW5hcnkgZmllbGQgd2l0aG91dCBzaXplIGlzIG9ubHkgYWxsb3dlZCBhdCB0aGUgZW5kIG9mIGEgYmluYXJ5IHBhdHRlcm4nXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGxldCBzaXplID0gMDtcbiAgICAgIGxldCBic1ZhbHVlQXJyYXlQYXJ0ID0gW107XG4gICAgICBsZXQgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IFtdO1xuICAgICAgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcblxuICAgICAgaWYgKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKFxuICAgICAgICAgIGJlZ2lubmluZ0luZGV4LFxuICAgICAgICAgIGJlZ2lubmluZ0luZGV4ICsgc2l6ZVxuICAgICAgICApO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICAgIHN3aXRjaCAoYml0c3RyaW5nTWF0Y2hQYXJ0LnR5cGUpIHtcbiAgICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LmF0dHJpYnV0ZXMgJiZcbiAgICAgICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LmF0dHJpYnV0ZXMuaW5kZXhPZignc2lnbmVkJykgIT0gLTFcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IEludDhBcnJheShbYnNWYWx1ZUFycmF5UGFydFswXV0pWzBdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgVWludDhBcnJheShbYnNWYWx1ZUFycmF5UGFydFswXV0pWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnZmxvYXQnOlxuICAgICAgICAgICAgaWYgKHNpemUgPT09IDY0KSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChGbG9hdDY0QXJyYXkuZnJvbShic1ZhbHVlQXJyYXlQYXJ0KVswXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNpemUgPT09IDMyKSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChGbG9hdDMyQXJyYXkuZnJvbShic1ZhbHVlQXJyYXlQYXJ0KVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpdHN0cmluZyc6XG4gICAgICAgICAgICBhcmdzLnB1c2goY3JlYXRlQml0U3RyaW5nKGJzVmFsdWVBcnJheVBhcnQpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMTYnOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjMyJzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDMyQXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRTaXplKHVuaXQsIHNpemUpIHtcbiAgcmV0dXJuIHVuaXQgKiBzaXplIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtOyBpKyspIHtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKSB7XG4gIGxldCBpbnRlZ2VyUGFydHMgPSBhcnIubWFwKGVsZW0gPT4gQml0U3RyaW5nLmludGVnZXIoZWxlbSkpO1xuICByZXR1cm4gbmV3IEJpdFN0cmluZyguLi5pbnRlZ2VyUGFydHMpO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTm9NYXRjaCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZXhwb3J0IHtcbiAgcmVzb2x2ZUJvdW5kLFxuICByZXNvbHZlV2lsZGNhcmQsXG4gIHJlc29sdmVWYXJpYWJsZSxcbiAgcmVzb2x2ZUhlYWRUYWlsLFxuICByZXNvbHZlQ2FwdHVyZSxcbiAgcmVzb2x2ZVN0YXJ0c1dpdGgsXG4gIHJlc29sdmVUeXBlLFxuICByZXNvbHZlQXJyYXksXG4gIHJlc29sdmVPYmplY3QsXG4gIHJlc29sdmVOb01hdGNoLFxuICByZXNvbHZlU3ltYm9sLFxuICByZXNvbHZlU3RyaW5nLFxuICByZXNvbHZlTnVtYmVyLFxuICByZXNvbHZlQm9vbGVhbixcbiAgcmVzb2x2ZUZ1bmN0aW9uLFxuICByZXNvbHZlTnVsbCxcbiAgcmVzb2x2ZUJpdFN0cmluZyxcbiAgcmVzb2x2ZU1hcFxufTtcbiIsImltcG9ydCAqIGFzIFJlc29sdmVycyBmcm9tICcuL3Jlc29sdmVycyc7XG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2hcbn0gZnJvbSAnLi90eXBlcyc7XG5cbmNvbnN0IHBhdHRlcm5NYXAgPSBuZXcgTWFwKCk7XG5wYXR0ZXJuTWFwLnNldChWYXJpYWJsZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlVmFyaWFibGUpO1xucGF0dGVybk1hcC5zZXQoV2lsZGNhcmQucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVdpbGRjYXJkKTtcbnBhdHRlcm5NYXAuc2V0KEhlYWRUYWlsLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVIZWFkVGFpbCk7XG5wYXR0ZXJuTWFwLnNldChTdGFydHNXaXRoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTdGFydHNXaXRoKTtcbnBhdHRlcm5NYXAuc2V0KENhcHR1cmUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUNhcHR1cmUpO1xucGF0dGVybk1hcC5zZXQoQm91bmQucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvdW5kKTtcbnBhdHRlcm5NYXAuc2V0KFR5cGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVR5cGUpO1xucGF0dGVybk1hcC5zZXQoQml0U3RyaW5nTWF0Y2gucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJpdFN0cmluZyk7XG5wYXR0ZXJuTWFwLnNldChOdW1iZXIucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcik7XG5wYXR0ZXJuTWFwLnNldChTeW1ib2wucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN5bWJvbCk7XG5wYXR0ZXJuTWFwLnNldChNYXAucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZU1hcCk7XG5wYXR0ZXJuTWFwLnNldChBcnJheS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQXJyYXkpO1xucGF0dGVybk1hcC5zZXQoU3RyaW5nLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoQm9vbGVhbi5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQm9vbGVhbik7XG5wYXR0ZXJuTWFwLnNldChGdW5jdGlvbi5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlRnVuY3Rpb24pO1xucGF0dGVybk1hcC5zZXQoT2JqZWN0LnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QpO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG4gIGlmIChwYXR0ZXJuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTnVsbChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pO1xuICB9XG5cbiAgY29uc3QgdHlwZSA9IHBhdHRlcm4uY29uc3RydWN0b3IucHJvdG90eXBlO1xuICBjb25zdCByZXNvbHZlciA9IHBhdHRlcm5NYXAuZ2V0KHR5cGUpO1xuXG4gIGlmIChyZXNvbHZlcikge1xuICAgIHJldHVybiByZXNvbHZlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgRlVOQyA9IFN5bWJvbCgpO1xuXG5leHBvcnQgY2xhc3MgTWF0Y2hFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoYXJnKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnc3ltYm9sJykge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICBsZXQgbWFwcGVkVmFsdWVzID0gYXJnLm1hcCh4ID0+IHtcbiAgICAgICAgaWYgKHggPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB4ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB4LnRvU3RyaW5nKCk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIG1hcHBlZFZhbHVlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZztcbiAgICB9XG5cbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgICBhcmdzLFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKVxuICAgICAgICApIHtcbiAgICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICAgIHBhcmFtcyA9IGZpbHRlcmVkUmVzdWx0O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpIHtcbiAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgIGNvbnN0IGFyaXR5Q2xhdXNlcyA9IGFyaXRpZXMuZ2V0KGFyZ3MubGVuZ3RoKTtcblxuICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgYXJpdHlDbGF1c2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgKTtcblxuICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgIGFsbE5hbWVzTWF0Y2ggJiZcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KVxuICAgICAgKSB7XG4gICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgIHBhcmFtcyA9IGZpbHRlcmVkUmVzdWx0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBbZnVuY1RvQ2FsbCwgcGFyYW1zXTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXJpdHlNYXAoY2xhdXNlcykge1xuICBsZXQgbWFwID0gbmV3IE1hcCgpO1xuXG4gIGZvciAoY29uc3QgY2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICBjb25zdCByYW5nZSA9IGdldEFyaXR5UmFuZ2UoY2xhdXNlKTtcblxuICAgIGZvciAoY29uc3QgYXJpdHkgb2YgcmFuZ2UpIHtcbiAgICAgIGxldCBhcml0eUNsYXVzZXMgPSBbXTtcblxuICAgICAgaWYgKG1hcC5oYXMoYXJpdHkpKSB7XG4gICAgICAgIGFyaXR5Q2xhdXNlcyA9IG1hcC5nZXQoYXJpdHkpO1xuICAgICAgfVxuXG4gICAgICBhcml0eUNsYXVzZXMucHVzaChjbGF1c2UpO1xuICAgICAgbWFwLnNldChhcml0eSwgYXJpdHlDbGF1c2VzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBnZXRBcml0eVJhbmdlKGNsYXVzZSkge1xuICBjb25zdCBtaW4gPSBjbGF1c2UuYXJpdHkgLSBjbGF1c2Uub3B0aW9uYWxzLmxlbmd0aDtcbiAgY29uc3QgbWF4ID0gY2xhdXNlLmFyaXR5O1xuXG4gIGxldCByYW5nZSA9IFttaW5dO1xuXG4gIHdoaWxlIChyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSAhPSBtYXgpIHtcbiAgICByYW5nZS5wdXNoKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICsgMSk7XG4gIH1cblxuICByZXR1cm4gcmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pIHtcbiAgbGV0IG9wdGlvbmFscyA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKykge1xuICAgIGlmIChcbiAgICAgIHBhdHRlcm5baV0gaW5zdGFuY2VvZiBUeXBlcy5WYXJpYWJsZSAmJlxuICAgICAgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlICE9IFN5bWJvbC5mb3IoJ3RhaWxvcmVkLm5vX3ZhbHVlJylcbiAgICApIHtcbiAgICAgIG9wdGlvbmFscy5wdXNoKFtpLCBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWVdKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3B0aW9uYWxzO1xufVxuXG5mdW5jdGlvbiBmaWxsSW5PcHRpb25hbFZhbHVlcyhhcmdzLCBhcml0eSwgb3B0aW9uYWxzKSB7XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkgfHwgb3B0aW9uYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgaWYgKGFyZ3MubGVuZ3RoICsgb3B0aW9uYWxzLmxlbmd0aCA8IGFyaXR5KSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBsZXQgbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwgPSBhcml0eSAtIGFyZ3MubGVuZ3RoO1xuICBsZXQgb3B0aW9uYWxzVG9SZW1vdmUgPSBvcHRpb25hbHMubGVuZ3RoIC0gbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGw7XG5cbiAgbGV0IG9wdGlvbmFsc1RvVXNlID0gb3B0aW9uYWxzLnNsaWNlKG9wdGlvbmFsc1RvUmVtb3ZlKTtcblxuICBmb3IgKGxldCBbaW5kZXgsIHZhbHVlXSBvZiBvcHRpb25hbHNUb1VzZSkge1xuICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAwLCB2YWx1ZSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaChwYXR0ZXJuLCBleHByLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KTtcbiAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICBpZiAoZG9lc01hdGNoICYmIGFsbE5hbWVzTWF0Y2ggJiYgZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKSB7XG4gICAgcmV0dXJuIGZpbHRlcmVkUmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBleHByKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihleHByKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdHMpIHtcbiAgY29uc3QgbmFtZXNNYXAgPSB7fTtcbiAgY29uc3QgZmlsdGVyZWRSZXN1bHRzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHJlc3VsdHNbaV07XG4gICAgaWYgKGN1cnJlbnQgaW5zdGFuY2VvZiBUeXBlcy5OYW1lZFZhcmlhYmxlUmVzdWx0KSB7XG4gICAgICBpZiAobmFtZXNNYXBbY3VycmVudC5uYW1lXSAmJiBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICE9PSBjdXJyZW50LnZhbHVlKSB7XG4gICAgICAgIHJldHVybiBbcmVzdWx0cywgZmFsc2VdO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgbmFtZXNNYXBbY3VycmVudC5uYW1lXSAmJlxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdID09PSBjdXJyZW50LnZhbHVlXG4gICAgICApIHtcbiAgICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdID0gY3VycmVudC52YWx1ZTtcbiAgICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudC52YWx1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKGN1cnJlbnQpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBbZmlsdGVyZWRSZXN1bHRzLCB0cnVlXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGxcbikge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gIGlmIChkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaCAmJiBndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdCkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHRfYXN5bmMoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gYXN5bmMgKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGxcbikge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuICBjb25zdCBtYXRjaGVzID0gZG9lc01hdGNoICYmIGFsbE5hbWVzTWF0Y2g7XG5cbiAgaWYgKG1hdGNoZXMgJiYgKGF3YWl0IGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcblxuY29uc3QgTk9fTUFUQ0ggPSBTeW1ib2woKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19nZW5lcmF0b3IocGF0dGVybiwgYml0c3RyaW5nKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgbGV0IGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoMCwgcGF0dGVybi5ieXRlX3NpemUoKSk7XG4gICAgbGV0IGkgPSAxO1xuXG4gICAgd2hpbGUgKGJzU2xpY2UuYnl0ZV9zaXplID09IHBhdHRlcm4uYnl0ZV9zaXplKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgYnNTbGljZSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiBpLFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogKGkgKyAxKVxuICAgICAgKTtcblxuICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2dlbmVyYXRvcihwYXR0ZXJuLCBsaXN0KSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgZm9yIChsZXQgaSBvZiBsaXN0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGksICgpID0+IHRydWUsIE5PX01BVENIKTtcbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3IsIGdlbmVyYXRvcnMpIHtcbiAgaWYgKGdlbmVyYXRvcnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yLm1hcCh4ID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgICAgIHJldHVybiB4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFt4XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsaXN0ID0gZ2VuZXJhdG9ycy5wb3AoKTtcblxuICAgIGxldCBuZXh0X2dlbiA9IFtdO1xuICAgIGZvciAobGV0IGogb2YgbGlzdCgpKSB7XG4gICAgICBmb3IgKGxldCBpIG9mIGdlbmVyYXRvcikge1xuICAgICAgICBuZXh0X2dlbi5wdXNoKFtqXS5jb25jYXQoaSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBydW5fZ2VuZXJhdG9ycyhuZXh0X2dlbiwgZ2VuZXJhdG9ycyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmVzdWx0ID0gcmVzdWx0Lm1hcCh4ID0+IEVybGFuZ1R5cGVzLkJpdFN0cmluZy5pbnRlZ2VyKHgpKTtcbiAgcmV0dXJuIG5ldyBFcmxhbmdUeXBlcy5CaXRTdHJpbmcoLi4ucmVzdWx0KTtcbn1cbiIsImltcG9ydCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIG1hdGNoX29yX2RlZmF1bHRfYXN5bmMsXG4gIGRlZm1hdGNoZ2VuLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luY1xufSBmcm9tICcuL3RhaWxvcmVkL2RlZm1hdGNoJztcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3RhaWxvcmVkL3R5cGVzJztcblxuaW1wb3J0IHtcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb25cbn0gZnJvbSAnLi90YWlsb3JlZC9jb21wcmVoZW5zaW9ucyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIGJpdFN0cmluZ01hdGNoLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBtYXRjaF9vcl9kZWZhdWx0X2FzeW5jLFxuICBkZWZtYXRjaGdlbixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBsaXN0X2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jXG59O1xuIl0sIm5hbWVzIjpbIlZhcmlhYmxlIiwibmFtZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsImhlYWQiLCJ0YWlsIiwiVHlwZSIsInR5cGUiLCJvYmpQYXR0ZXJuIiwiQm91bmQiLCJCaXRTdHJpbmdNYXRjaCIsInZhbHVlcyIsImxlbmd0aCIsImJ5dGVfc2l6ZSIsInMiLCJ2YWwiLCJ1bml0Iiwic2l6ZSIsImluZGV4IiwiZ2V0VmFsdWUiLCJOYW1lZFZhcmlhYmxlUmVzdWx0IiwidmFyaWFibGUiLCJ3aWxkY2FyZCIsInN0YXJ0c1dpdGgiLCJjYXB0dXJlIiwiaGVhZFRhaWwiLCJib3VuZCIsImJpdFN0cmluZ01hdGNoIiwibmFtZWRWYXJpYWJsZVJlc3VsdCIsImlzX251bWJlciIsImlzX3N0cmluZyIsImlzX2Jvb2xlYW4iLCJpc19zeW1ib2wiLCJpc19vYmplY3QiLCJpc192YXJpYWJsZSIsImlzX251bGwiLCJpc19hcnJheSIsIkFycmF5IiwiaXNBcnJheSIsImlzX2Z1bmN0aW9uIiwiRnVuY3Rpb24iLCJpc19tYXAiLCJNYXAiLCJCaXRTdHJpbmciLCJFcmxhbmdUeXBlcyIsInJlc29sdmVTeW1ib2wiLCJwYXR0ZXJuIiwiQ2hlY2tzIiwicmVzb2x2ZVN0cmluZyIsInJlc29sdmVOdW1iZXIiLCJyZXNvbHZlQm9vbGVhbiIsInJlc29sdmVGdW5jdGlvbiIsInJlc29sdmVOdWxsIiwicmVzb2x2ZUJvdW5kIiwiYXJncyIsInJlc29sdmVXaWxkY2FyZCIsInJlc29sdmVWYXJpYWJsZSIsInB1c2giLCJUeXBlcyIsInJlc29sdmVIZWFkVGFpbCIsImhlYWRNYXRjaGVzIiwiYnVpbGRNYXRjaCIsInRhaWxNYXRjaGVzIiwic2xpY2UiLCJyZXNvbHZlQ2FwdHVyZSIsIm1hdGNoZXMiLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlTWFwIiwia2V5cyIsImZyb20iLCJrZXkiLCJzZXQiLCJnZXQiLCJoYXMiLCJyZXNvbHZlT2JqZWN0IiwiT2JqZWN0IiwiY29uY2F0IiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwicmVzb2x2ZUJpdFN0cmluZyIsInBhdHRlcm5CaXRTdHJpbmciLCJiaXRzdHJpbmdNYXRjaFBhcnQiLCJnZXRTaXplIiwicGF0dGVyblZhbHVlcyIsImJzVmFsdWUiLCJiaW5hcnkiLCJiZWdpbm5pbmdJbmRleCIsInVuZGVmaW5lZCIsIkVycm9yIiwiYnNWYWx1ZUFycmF5UGFydCIsInBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQiLCJhdHRyaWJ1dGVzIiwiaW5kZXhPZiIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJGbG9hdDY0QXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJjcmVhdGVCaXRTdHJpbmciLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJhcHBseSIsIlVpbnQxNkFycmF5IiwiVWludDMyQXJyYXkiLCJhcnJheXNFcXVhbCIsImEiLCJiIiwiZmlsbEFycmF5IiwiYXJyIiwibnVtIiwiaW50ZWdlclBhcnRzIiwiZWxlbSIsImludGVnZXIiLCJyZXNvbHZlTm9NYXRjaCIsInBhdHRlcm5NYXAiLCJwcm90b3R5cGUiLCJSZXNvbHZlcnMiLCJOdW1iZXIiLCJCb29sZWFuIiwiY29uc3RydWN0b3IiLCJyZXNvbHZlciIsIk1hdGNoRXJyb3IiLCJhcmciLCJtZXNzYWdlIiwidG9TdHJpbmciLCJtYXBwZWRWYWx1ZXMiLCJDbGF1c2UiLCJmbiIsImd1YXJkIiwiYXJpdHkiLCJvcHRpb25hbHMiLCJnZXRPcHRpb25hbFZhbHVlcyIsImNsYXVzZSIsImRlZm1hdGNoIiwiY2xhdXNlcyIsImFyaXRpZXMiLCJnZXRBcml0eU1hcCIsImZ1bmNUb0NhbGwiLCJwYXJhbXMiLCJmaW5kTWF0Y2hpbmdGdW5jdGlvbiIsImRlZm1hdGNoZ2VuIiwiZGVmbWF0Y2hHZW4iLCJkZWZtYXRjaEFzeW5jIiwiYXJpdHlDbGF1c2VzIiwicHJvY2Vzc2VkQ2xhdXNlIiwicmVzdWx0IiwiZmlsbEluT3B0aW9uYWxWYWx1ZXMiLCJkb2VzTWF0Y2giLCJmaWx0ZXJlZFJlc3VsdCIsImFsbE5hbWVzTWF0Y2giLCJjaGVja05hbWVkVmFyaWFibGVzIiwiZXJyb3IiLCJyYW5nZSIsImdldEFyaXR5UmFuZ2UiLCJtaW4iLCJtYXgiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwicmVzdWx0cyIsIm5hbWVzTWFwIiwiZmlsdGVyZWRSZXN1bHRzIiwiY3VycmVudCIsIm1hdGNoX29yX2RlZmF1bHQiLCJtYXRjaF9vcl9kZWZhdWx0X2FzeW5jIiwiTk9fTUFUQ0giLCJiaXRzdHJpbmdfZ2VuZXJhdG9yIiwiYml0c3RyaW5nIiwicmV0dXJuUmVzdWx0IiwiYnNTbGljZSIsImxpc3RfZ2VuZXJhdG9yIiwibGlzdCIsImxpc3RfY29tcHJlaGVuc2lvbiIsImV4cHJlc3Npb24iLCJnZW5lcmF0b3JzIiwiZ2VuZXJhdGVkVmFsdWVzIiwicnVuX2dlbmVyYXRvcnMiLCJwb3AiLCJnZW5lcmF0b3IiLCJuZXh0X2dlbiIsImoiLCJiaXRzdHJpbmdfY29tcHJlaGVuc2lvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7O0FBRUEsTUFBTUEsUUFBTixDQUFlO2NBQ0RDLE9BQU8sSUFBbkIsRUFBeUJDLGdCQUFnQkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBQXpDLEVBQTBFO1NBQ25FSCxJQUFMLEdBQVlBLElBQVo7U0FDS0MsYUFBTCxHQUFxQkEsYUFBckI7Ozs7QUFJSixNQUFNRyxRQUFOLENBQWU7Z0JBQ0M7OztBQUdoQixNQUFNQyxVQUFOLENBQWlCO2NBQ0hDLE1BQVosRUFBb0I7U0FDYkEsTUFBTCxHQUFjQSxNQUFkOzs7O0FBSUosTUFBTUMsT0FBTixDQUFjO2NBQ0FDLEtBQVosRUFBbUI7U0FDWkEsS0FBTCxHQUFhQSxLQUFiOzs7O0FBSUosTUFBTUMsUUFBTixDQUFlO2NBQ0RDLElBQVosRUFBa0JDLElBQWxCLEVBQXdCO1NBQ2pCRCxJQUFMLEdBQVlBLElBQVo7U0FDS0MsSUFBTCxHQUFZQSxJQUFaOzs7O0FBSUosTUFBTUMsSUFBTixDQUFXO2NBQ0dDLElBQVosRUFBa0JDLGFBQWEsRUFBL0IsRUFBbUM7U0FDNUJELElBQUwsR0FBWUEsSUFBWjtTQUNLQyxVQUFMLEdBQWtCQSxVQUFsQjs7OztBQUlKLE1BQU1DLEtBQU4sQ0FBWTtjQUNFUCxLQUFaLEVBQW1CO1NBQ1pBLEtBQUwsR0FBYUEsS0FBYjs7OztBQUlKLE1BQU1RLGNBQU4sQ0FBcUI7Y0FDUCxHQUFHQyxNQUFmLEVBQXVCO1NBQ2hCQSxNQUFMLEdBQWNBLE1BQWQ7OztXQUdPO1dBQ0FBLE9BQU9DLE1BQWQ7OzthQUdTO1dBQ0YsS0FBS0MsU0FBTCxLQUFtQixDQUExQjs7O2NBR1U7UUFDTkMsSUFBSSxDQUFSOztTQUVLLElBQUlDLEdBQVQsSUFBZ0IsS0FBS0osTUFBckIsRUFBNkI7VUFDdkJHLElBQUlDLElBQUlDLElBQUosR0FBV0QsSUFBSUUsSUFBZixHQUFzQixDQUE5Qjs7O1dBR0tILENBQVA7OztXQUdPSSxLQUFULEVBQWdCO1dBQ1AsS0FBS1AsTUFBTCxDQUFZTyxLQUFaLENBQVA7OztpQkFHYUEsS0FBZixFQUFzQjtRQUNoQkgsTUFBTSxLQUFLSSxRQUFMLENBQWNELEtBQWQsQ0FBVjtXQUNPSCxJQUFJQyxJQUFKLEdBQVdELElBQUlFLElBQXRCOzs7aUJBR2FDLEtBQWYsRUFBc0I7V0FDYixLQUFLQyxRQUFMLENBQWNELEtBQWQsRUFBcUJYLElBQTVCOzs7O0FBSUosTUFBTWEsbUJBQU4sQ0FBMEI7Y0FDWjFCLElBQVosRUFBa0JRLEtBQWxCLEVBQXlCO1NBQ2xCUixJQUFMLEdBQVlBLElBQVo7U0FDS1EsS0FBTCxHQUFhQSxLQUFiOzs7O0FBSUosU0FBU21CLFFBQVQsQ0FDRTNCLE9BQU8sSUFEVCxFQUVFQyxnQkFBZ0JDLE9BQU9DLEdBQVAsQ0FBVyxtQkFBWCxDQUZsQixFQUdFO1NBQ08sSUFBSUosUUFBSixDQUFhQyxJQUFiLEVBQW1CQyxhQUFuQixDQUFQOzs7QUFHRixTQUFTMkIsUUFBVCxHQUFvQjtTQUNYLElBQUl4QixRQUFKLEVBQVA7OztBQUdGLFNBQVN5QixVQUFULENBQW9CdkIsTUFBcEIsRUFBNEI7U0FDbkIsSUFBSUQsVUFBSixDQUFlQyxNQUFmLENBQVA7OztBQUdGLFNBQVN3QixPQUFULENBQWlCdEIsS0FBakIsRUFBd0I7U0FDZixJQUFJRCxPQUFKLENBQVlDLEtBQVosQ0FBUDs7O0FBR0YsU0FBU3VCLFFBQVQsQ0FBa0JyQixJQUFsQixFQUF3QkMsSUFBeEIsRUFBOEI7U0FDckIsSUFBSUYsUUFBSixDQUFhQyxJQUFiLEVBQW1CQyxJQUFuQixDQUFQOzs7QUFHRixTQUFTRSxJQUFULENBQWNBLElBQWQsRUFBb0JDLGFBQWEsRUFBakMsRUFBcUM7U0FDNUIsSUFBSUYsSUFBSixDQUFTQyxJQUFULEVBQWVDLFVBQWYsQ0FBUDs7O0FBR0YsU0FBU2tCLEtBQVQsQ0FBZXhCLEtBQWYsRUFBc0I7U0FDYixJQUFJTyxLQUFKLENBQVVQLEtBQVYsQ0FBUDs7O0FBR0YsU0FBU3lCLGNBQVQsQ0FBd0IsR0FBR2hCLE1BQTNCLEVBQW1DO1NBQzFCLElBQUlELGNBQUosQ0FBbUIsR0FBR0MsTUFBdEIsQ0FBUDs7O0FBR0YsU0FBU2lCLG1CQUFULENBQTZCbEMsSUFBN0IsRUFBbUNRLEtBQW5DLEVBQTBDO1NBQ2pDLElBQUlrQixtQkFBSixDQUF3QjFCLElBQXhCLEVBQThCUSxLQUE5QixDQUFQOzs7QUM3SEY7O0FBRUEsQUFXQSxTQUFTMkIsU0FBVCxDQUFtQjNCLEtBQW5CLEVBQTBCO1NBQ2pCLE9BQU9BLEtBQVAsS0FBaUIsUUFBeEI7OztBQUdGLFNBQVM0QixTQUFULENBQW1CNUIsS0FBbkIsRUFBMEI7U0FDakIsT0FBT0EsS0FBUCxLQUFpQixRQUF4Qjs7O0FBR0YsU0FBUzZCLFVBQVQsQ0FBb0I3QixLQUFwQixFQUEyQjtTQUNsQixPQUFPQSxLQUFQLEtBQWlCLFNBQXhCOzs7QUFHRixTQUFTOEIsU0FBVCxDQUFtQjlCLEtBQW5CLEVBQTBCO1NBQ2pCLE9BQU9BLEtBQVAsS0FBaUIsUUFBeEI7OztBQUdGLEFBSUEsU0FBUytCLFNBQVQsQ0FBbUIvQixLQUFuQixFQUEwQjtTQUNqQixPQUFPQSxLQUFQLEtBQWlCLFFBQXhCOzs7QUFHRixTQUFTZ0MsV0FBVCxDQUFxQmhDLEtBQXJCLEVBQTRCO1NBQ25CQSxpQkFBaUJULFFBQXhCOzs7QUFHRixBQTRCQSxTQUFTMEMsT0FBVCxDQUFpQmpDLEtBQWpCLEVBQXdCO1NBQ2ZBLFVBQVUsSUFBakI7OztBQUdGLFNBQVNrQyxRQUFULENBQWtCbEMsS0FBbEIsRUFBeUI7U0FDaEJtQyxNQUFNQyxPQUFOLENBQWNwQyxLQUFkLENBQVA7OztBQUdGLFNBQVNxQyxXQUFULENBQXFCckMsS0FBckIsRUFBNEI7U0FDbkIsT0FBT0EsS0FBUCxLQUFpQixVQUFqQixJQUErQkEsaUJBQWlCc0MsUUFBdkQ7OztBQUdGLFNBQVNDLE1BQVQsQ0FBZ0J2QyxLQUFoQixFQUF1QjtTQUNkQSxpQkFBaUJ3QyxHQUF4Qjs7O0FDbEZGOztBQUVBLEFBSUEsTUFBTUMsWUFBWUMsWUFBWUQsU0FBOUI7O0FBRUEsU0FBU0UsYUFBVCxDQUF1QkMsT0FBdkIsRUFBZ0M7U0FDdkIsVUFBUzVDLEtBQVQsRUFBZ0I7V0FDZDZDLFNBQUEsQ0FBaUI3QyxLQUFqQixLQUEyQkEsVUFBVTRDLE9BQTVDO0dBREY7OztBQUtGLFNBQVNFLGFBQVQsQ0FBdUJGLE9BQXZCLEVBQWdDO1NBQ3ZCLFVBQVM1QyxLQUFULEVBQWdCO1dBQ2Q2QyxTQUFBLENBQWlCN0MsS0FBakIsS0FBMkJBLFVBQVU0QyxPQUE1QztHQURGOzs7QUFLRixTQUFTRyxhQUFULENBQXVCSCxPQUF2QixFQUFnQztTQUN2QixVQUFTNUMsS0FBVCxFQUFnQjtXQUNkNkMsU0FBQSxDQUFpQjdDLEtBQWpCLEtBQTJCQSxVQUFVNEMsT0FBNUM7R0FERjs7O0FBS0YsU0FBU0ksY0FBVCxDQUF3QkosT0FBeEIsRUFBaUM7U0FDeEIsVUFBUzVDLEtBQVQsRUFBZ0I7V0FDZDZDLFVBQUEsQ0FBa0I3QyxLQUFsQixLQUE0QkEsVUFBVTRDLE9BQTdDO0dBREY7OztBQUtGLFNBQVNLLGVBQVQsQ0FBeUJMLE9BQXpCLEVBQWtDO1NBQ3pCLFVBQVM1QyxLQUFULEVBQWdCO1dBQ2Q2QyxXQUFBLENBQW1CN0MsS0FBbkIsS0FBNkJBLFVBQVU0QyxPQUE5QztHQURGOzs7QUFLRixTQUFTTSxXQUFULENBQXFCTixPQUFyQixFQUE4QjtTQUNyQixVQUFTNUMsS0FBVCxFQUFnQjtXQUNkNkMsT0FBQSxDQUFlN0MsS0FBZixDQUFQO0dBREY7OztBQUtGLFNBQVNtRCxZQUFULENBQXNCUCxPQUF0QixFQUErQjtTQUN0QixVQUFTNUMsS0FBVCxFQUFnQm9ELElBQWhCLEVBQXNCO1FBQ3ZCLE9BQU9wRCxLQUFQLEtBQWlCLE9BQU80QyxRQUFRNUMsS0FBaEMsSUFBeUNBLFVBQVU0QyxRQUFRNUMsS0FBL0QsRUFBc0U7YUFDN0QsSUFBUDs7O1dBR0ssS0FBUDtHQUxGOzs7QUFTRixTQUFTcUQsZUFBVCxHQUEyQjtTQUNsQixZQUFXO1dBQ1QsSUFBUDtHQURGOzs7QUFLRixTQUFTQyxlQUFULENBQXlCVixPQUF6QixFQUFrQztTQUN6QixVQUFTNUMsS0FBVCxFQUFnQm9ELElBQWhCLEVBQXNCO1FBQ3ZCUixRQUFRcEQsSUFBUixLQUFpQixJQUFyQixFQUEyQjtXQUNwQitELElBQUwsQ0FBVXZELEtBQVY7S0FERixNQUVPLElBQUksQ0FBQzRDLFFBQVFwRCxJQUFSLENBQWE2QixVQUFiLENBQXdCLEdBQXhCLENBQUwsRUFBbUM7V0FDbkNrQyxJQUFMLENBQVVDLG1CQUFBLENBQTBCWixRQUFRcEQsSUFBbEMsRUFBd0NRLEtBQXhDLENBQVY7OztXQUdLLElBQVA7R0FQRjs7O0FBV0YsU0FBU3lELGVBQVQsQ0FBeUJiLE9BQXpCLEVBQWtDO1FBQzFCYyxjQUFjQyxXQUFXZixRQUFRMUMsSUFBbkIsQ0FBcEI7UUFDTTBELGNBQWNELFdBQVdmLFFBQVF6QyxJQUFuQixDQUFwQjs7U0FFTyxVQUFTSCxLQUFULEVBQWdCb0QsSUFBaEIsRUFBc0I7UUFDdkIsQ0FBQ1AsUUFBQSxDQUFnQjdDLEtBQWhCLENBQUQsSUFBMkJBLE1BQU1VLE1BQU4sS0FBaUIsQ0FBaEQsRUFBbUQ7YUFDMUMsS0FBUDs7O1VBR0lSLE9BQU9GLE1BQU0sQ0FBTixDQUFiO1VBQ01HLE9BQU9ILE1BQU02RCxLQUFOLENBQVksQ0FBWixDQUFiOztRQUVJSCxZQUFZeEQsSUFBWixFQUFrQmtELElBQWxCLEtBQTJCUSxZQUFZekQsSUFBWixFQUFrQmlELElBQWxCLENBQS9CLEVBQXdEO2FBQy9DLElBQVA7OztXQUdLLEtBQVA7R0FaRjs7O0FBZ0JGLFNBQVNVLGNBQVQsQ0FBd0JsQixPQUF4QixFQUFpQztRQUN6Qm1CLFVBQVVKLFdBQVdmLFFBQVE1QyxLQUFuQixDQUFoQjs7U0FFTyxVQUFTQSxLQUFULEVBQWdCb0QsSUFBaEIsRUFBc0I7UUFDdkJXLFFBQVEvRCxLQUFSLEVBQWVvRCxJQUFmLENBQUosRUFBMEI7V0FDbkJHLElBQUwsQ0FBVXZELEtBQVY7YUFDTyxJQUFQOzs7V0FHSyxLQUFQO0dBTkY7OztBQVVGLFNBQVNnRSxpQkFBVCxDQUEyQnBCLE9BQTNCLEVBQW9DO1FBQzVCOUMsU0FBUzhDLFFBQVE5QyxNQUF2Qjs7U0FFTyxVQUFTRSxLQUFULEVBQWdCb0QsSUFBaEIsRUFBc0I7UUFDdkJQLFNBQUEsQ0FBaUI3QyxLQUFqQixLQUEyQkEsTUFBTXFCLFVBQU4sQ0FBaUJ2QixNQUFqQixDQUEvQixFQUF5RDtXQUNsRHlELElBQUwsQ0FBVXZELE1BQU1pRSxTQUFOLENBQWdCbkUsT0FBT1ksTUFBdkIsQ0FBVjthQUNPLElBQVA7OztXQUdLLEtBQVA7R0FORjs7O0FBVUYsU0FBU3dELFdBQVQsQ0FBcUJ0QixPQUFyQixFQUE4QjtTQUNyQixVQUFTNUMsS0FBVCxFQUFnQm9ELElBQWhCLEVBQXNCO1FBQ3ZCcEQsaUJBQWlCNEMsUUFBUXZDLElBQTdCLEVBQW1DO1lBQzNCMEQsVUFBVUosV0FBV2YsUUFBUXRDLFVBQW5CLENBQWhCO2FBQ095RCxRQUFRL0QsS0FBUixFQUFlb0QsSUFBZixDQUFQOzs7V0FHSyxLQUFQO0dBTkY7OztBQVVGLFNBQVNlLFlBQVQsQ0FBc0J2QixPQUF0QixFQUErQjtRQUN2Qm1CLFVBQVVuQixRQUFRd0IsR0FBUixDQUFZQyxLQUFLVixXQUFXVSxDQUFYLENBQWpCLENBQWhCOztTQUVPLFVBQVNyRSxLQUFULEVBQWdCb0QsSUFBaEIsRUFBc0I7UUFDdkIsQ0FBQ1AsUUFBQSxDQUFnQjdDLEtBQWhCLENBQUQsSUFBMkJBLE1BQU1VLE1BQU4sSUFBZ0JrQyxRQUFRbEMsTUFBdkQsRUFBK0Q7YUFDdEQsS0FBUDs7O1dBR0tWLE1BQU1zRSxLQUFOLENBQVksVUFBU0MsQ0FBVCxFQUFZQyxDQUFaLEVBQWU7YUFDekJULFFBQVFTLENBQVIsRUFBV3hFLE1BQU13RSxDQUFOLENBQVgsRUFBcUJwQixJQUFyQixDQUFQO0tBREssQ0FBUDtHQUxGOzs7QUFXRixTQUFTcUIsVUFBVCxDQUFvQjdCLE9BQXBCLEVBQTZCO01BQ3ZCbUIsVUFBVSxJQUFJdkIsR0FBSixFQUFkOztRQUVNa0MsT0FBT3ZDLE1BQU13QyxJQUFOLENBQVcvQixRQUFROEIsSUFBUixFQUFYLENBQWI7O09BRUssSUFBSUUsR0FBVCxJQUFnQkYsSUFBaEIsRUFBc0I7WUFDWkcsR0FBUixDQUFZRCxHQUFaLEVBQWlCakIsV0FBV2YsUUFBUWtDLEdBQVIsQ0FBWUYsR0FBWixDQUFYLENBQWpCOzs7U0FHSyxVQUFTNUUsS0FBVCxFQUFnQm9ELElBQWhCLEVBQXNCO1FBQ3ZCLENBQUNQLE1BQUEsQ0FBYzdDLEtBQWQsQ0FBRCxJQUF5QjRDLFFBQVE3QixJQUFSLEdBQWVmLE1BQU1lLElBQWxELEVBQXdEO2FBQy9DLEtBQVA7OztTQUdHLElBQUk2RCxHQUFULElBQWdCRixJQUFoQixFQUFzQjtVQUNoQixDQUFDMUUsTUFBTStFLEdBQU4sQ0FBVUgsR0FBVixDQUFELElBQW1CLENBQUNiLFFBQVFlLEdBQVIsQ0FBWUYsR0FBWixFQUFpQjVFLE1BQU04RSxHQUFOLENBQVVGLEdBQVYsQ0FBakIsRUFBaUN4QixJQUFqQyxDQUF4QixFQUFnRTtlQUN2RCxLQUFQOzs7O1dBSUcsSUFBUDtHQVhGOzs7QUFlRixTQUFTNEIsYUFBVCxDQUF1QnBDLE9BQXZCLEVBQWdDO01BQzFCbUIsVUFBVSxFQUFkOztRQUVNVyxPQUFPTyxPQUFPUCxJQUFQLENBQVk5QixPQUFaLEVBQXFCc0MsTUFBckIsQ0FDWEQsT0FBT0UscUJBQVAsQ0FBNkJ2QyxPQUE3QixDQURXLENBQWI7O09BSUssSUFBSWdDLEdBQVQsSUFBZ0JGLElBQWhCLEVBQXNCO1lBQ1pFLEdBQVIsSUFBZWpCLFdBQVdmLFFBQVFnQyxHQUFSLENBQVgsQ0FBZjs7O1NBR0ssVUFBUzVFLEtBQVQsRUFBZ0JvRCxJQUFoQixFQUFzQjtRQUN2QixDQUFDUCxTQUFBLENBQWlCN0MsS0FBakIsQ0FBRCxJQUE0QjRDLFFBQVFsQyxNQUFSLEdBQWlCVixNQUFNVSxNQUF2RCxFQUErRDthQUN0RCxLQUFQOzs7U0FHRyxJQUFJa0UsR0FBVCxJQUFnQkYsSUFBaEIsRUFBc0I7VUFDaEIsRUFBRUUsT0FBTzVFLEtBQVQsS0FBbUIsQ0FBQytELFFBQVFhLEdBQVIsRUFBYTVFLE1BQU00RSxHQUFOLENBQWIsRUFBeUJ4QixJQUF6QixDQUF4QixFQUF3RDtlQUMvQyxLQUFQOzs7O1dBSUcsSUFBUDtHQVhGOzs7QUFlRixTQUFTZ0MsZ0JBQVQsQ0FBMEJ4QyxPQUExQixFQUFtQztNQUM3QnlDLG1CQUFtQixFQUF2Qjs7T0FFSyxJQUFJQyxrQkFBVCxJQUErQjFDLFFBQVFuQyxNQUF2QyxFQUErQztRQUN6Q29DLFdBQUEsQ0FBbUJ5QyxtQkFBbUJ0RixLQUF0QyxDQUFKLEVBQWtEO1VBQzVDZSxPQUFPd0UsUUFBUUQsbUJBQW1CeEUsSUFBM0IsRUFBaUN3RSxtQkFBbUJ2RSxJQUFwRCxDQUFYO2dCQUNVc0UsZ0JBQVYsRUFBNEJ0RSxJQUE1QjtLQUZGLE1BR087eUJBQ2NzRSxpQkFBaUJILE1BQWpCLENBQ2pCLElBQUl6QyxTQUFKLENBQWM2QyxrQkFBZCxFQUFrQ3RGLEtBRGpCLENBQW5COzs7O01BTUF3RixnQkFBZ0I1QyxRQUFRbkMsTUFBNUI7O1NBRU8sVUFBU1QsS0FBVCxFQUFnQm9ELElBQWhCLEVBQXNCO1FBQ3ZCcUMsVUFBVSxJQUFkOztRQUVJLENBQUM1QyxTQUFBLENBQWlCN0MsS0FBakIsQ0FBRCxJQUE0QixFQUFFQSxpQkFBaUJ5QyxTQUFuQixDQUFoQyxFQUErRDthQUN0RCxLQUFQOzs7UUFHRUksU0FBQSxDQUFpQjdDLEtBQWpCLENBQUosRUFBNkI7Z0JBQ2pCLElBQUl5QyxTQUFKLENBQWNBLFVBQVVpRCxNQUFWLENBQWlCMUYsS0FBakIsQ0FBZCxDQUFWO0tBREYsTUFFTztnQkFDS0EsS0FBVjs7O1FBR0UyRixpQkFBaUIsQ0FBckI7O1NBRUssSUFBSW5CLElBQUksQ0FBYixFQUFnQkEsSUFBSWdCLGNBQWM5RSxNQUFsQyxFQUEwQzhELEdBQTFDLEVBQStDO1VBQ3pDYyxxQkFBcUJFLGNBQWNoQixDQUFkLENBQXpCOztVQUdFM0IsV0FBQSxDQUFtQnlDLG1CQUFtQnRGLEtBQXRDLEtBQ0FzRixtQkFBbUJqRixJQUFuQixJQUEyQixRQUQzQixJQUVBaUYsbUJBQW1CdkUsSUFBbkIsS0FBNEI2RSxTQUY1QixJQUdBcEIsSUFBSWdCLGNBQWM5RSxNQUFkLEdBQXVCLENBSjdCLEVBS0U7Y0FDTSxJQUFJbUYsS0FBSixDQUNKLDRFQURJLENBQU47OztVQUtFOUUsT0FBTyxDQUFYO1VBQ0krRSxtQkFBbUIsRUFBdkI7VUFDSUMsNEJBQTRCLEVBQWhDO2FBQ09SLFFBQVFELG1CQUFtQnhFLElBQTNCLEVBQWlDd0UsbUJBQW1CdkUsSUFBcEQsQ0FBUDs7VUFFSXlELE1BQU1nQixjQUFjOUUsTUFBZCxHQUF1QixDQUFqQyxFQUFvQzsyQkFDZitFLFFBQVF6RixLQUFSLENBQWM2RCxLQUFkLENBQW9COEIsY0FBcEIsQ0FBbkI7b0NBQzRCTixpQkFBaUJ4QixLQUFqQixDQUF1QjhCLGNBQXZCLENBQTVCO09BRkYsTUFHTzsyQkFDY0YsUUFBUXpGLEtBQVIsQ0FBYzZELEtBQWQsQ0FDakI4QixjQURpQixFQUVqQkEsaUJBQWlCNUUsSUFGQSxDQUFuQjtvQ0FJNEJzRSxpQkFBaUJ4QixLQUFqQixDQUMxQjhCLGNBRDBCLEVBRTFCQSxpQkFBaUI1RSxJQUZTLENBQTVCOzs7VUFNRThCLFdBQUEsQ0FBbUJ5QyxtQkFBbUJ0RixLQUF0QyxDQUFKLEVBQWtEO2dCQUN4Q3NGLG1CQUFtQmpGLElBQTNCO2VBQ08sU0FBTDtnQkFFSWlGLG1CQUFtQlUsVUFBbkIsSUFDQVYsbUJBQW1CVSxVQUFuQixDQUE4QkMsT0FBOUIsQ0FBc0MsUUFBdEMsS0FBbUQsQ0FBQyxDQUZ0RCxFQUdFO21CQUNLMUMsSUFBTCxDQUFVLElBQUkyQyxTQUFKLENBQWMsQ0FBQ0osaUJBQWlCLENBQWpCLENBQUQsQ0FBZCxFQUFxQyxDQUFyQyxDQUFWO2FBSkYsTUFLTzttQkFDQXZDLElBQUwsQ0FBVSxJQUFJNEMsVUFBSixDQUFlLENBQUNMLGlCQUFpQixDQUFqQixDQUFELENBQWYsRUFBc0MsQ0FBdEMsQ0FBVjs7OztlQUlDLE9BQUw7Z0JBQ00vRSxTQUFTLEVBQWIsRUFBaUI7bUJBQ1Z3QyxJQUFMLENBQVU2QyxhQUFhekIsSUFBYixDQUFrQm1CLGdCQUFsQixFQUFvQyxDQUFwQyxDQUFWO2FBREYsTUFFTyxJQUFJL0UsU0FBUyxFQUFiLEVBQWlCO21CQUNqQndDLElBQUwsQ0FBVThDLGFBQWExQixJQUFiLENBQWtCbUIsZ0JBQWxCLEVBQW9DLENBQXBDLENBQVY7YUFESyxNQUVBO3FCQUNFLEtBQVA7Ozs7ZUFJQyxXQUFMO2lCQUNPdkMsSUFBTCxDQUFVK0MsZ0JBQWdCUixnQkFBaEIsQ0FBVjs7O2VBR0csUUFBTDtpQkFDT3ZDLElBQUwsQ0FDRWdELE9BQU9DLFlBQVAsQ0FBb0JDLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDLElBQUlOLFVBQUosQ0FBZUwsZ0JBQWYsQ0FBaEMsQ0FERjs7O2VBS0csTUFBTDtpQkFDT3ZDLElBQUwsQ0FDRWdELE9BQU9DLFlBQVAsQ0FBb0JDLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDLElBQUlOLFVBQUosQ0FBZUwsZ0JBQWYsQ0FBaEMsQ0FERjs7O2VBS0csT0FBTDtpQkFDT3ZDLElBQUwsQ0FDRWdELE9BQU9DLFlBQVAsQ0FBb0JDLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDLElBQUlDLFdBQUosQ0FBZ0JaLGdCQUFoQixDQUFoQyxDQURGOzs7ZUFLRyxPQUFMO2lCQUNPdkMsSUFBTCxDQUNFZ0QsT0FBT0MsWUFBUCxDQUFvQkMsS0FBcEIsQ0FBMEIsSUFBMUIsRUFBZ0MsSUFBSUUsV0FBSixDQUFnQmIsZ0JBQWhCLENBQWhDLENBREY7Ozs7bUJBTU8sS0FBUDs7T0FwRE4sTUFzRE8sSUFBSSxDQUFDYyxZQUFZZCxnQkFBWixFQUE4QkMseUJBQTlCLENBQUwsRUFBK0Q7ZUFDN0QsS0FBUDs7O3VCQUdlSixpQkFBaUI1RSxJQUFsQzs7O1dBR0ssSUFBUDtHQTdHRjs7O0FBaUhGLFNBQVN3RSxPQUFULENBQWlCekUsSUFBakIsRUFBdUJDLElBQXZCLEVBQTZCO1NBQ3BCRCxPQUFPQyxJQUFQLEdBQWMsQ0FBckI7OztBQUdGLFNBQVM2RixXQUFULENBQXFCQyxDQUFyQixFQUF3QkMsQ0FBeEIsRUFBMkI7TUFDckJELE1BQU1DLENBQVYsRUFBYSxPQUFPLElBQVA7TUFDVEQsS0FBSyxJQUFMLElBQWFDLEtBQUssSUFBdEIsRUFBNEIsT0FBTyxLQUFQO01BQ3hCRCxFQUFFbkcsTUFBRixJQUFZb0csRUFBRXBHLE1BQWxCLEVBQTBCLE9BQU8sS0FBUDs7T0FFckIsSUFBSThELElBQUksQ0FBYixFQUFnQkEsSUFBSXFDLEVBQUVuRyxNQUF0QixFQUE4QixFQUFFOEQsQ0FBaEMsRUFBbUM7UUFDN0JxQyxFQUFFckMsQ0FBRixNQUFTc0MsRUFBRXRDLENBQUYsQ0FBYixFQUFtQixPQUFPLEtBQVA7OztTQUdkLElBQVA7OztBQUdGLFNBQVN1QyxTQUFULENBQW1CQyxHQUFuQixFQUF3QkMsR0FBeEIsRUFBNkI7T0FDdEIsSUFBSXpDLElBQUksQ0FBYixFQUFnQkEsSUFBSXlDLEdBQXBCLEVBQXlCekMsR0FBekIsRUFBOEI7UUFDeEJqQixJQUFKLENBQVMsQ0FBVDs7OztBQUlKLFNBQVMrQyxlQUFULENBQXlCVSxHQUF6QixFQUE4QjtNQUN4QkUsZUFBZUYsSUFBSTVDLEdBQUosQ0FBUStDLFFBQVExRSxVQUFVMkUsT0FBVixDQUFrQkQsSUFBbEIsQ0FBaEIsQ0FBbkI7U0FDTyxJQUFJMUUsU0FBSixDQUFjLEdBQUd5RSxZQUFqQixDQUFQOzs7QUFHRixTQUFTRyxjQUFULEdBQTBCO1NBQ2pCLFlBQVc7V0FDVCxLQUFQO0dBREY7OztBQ2xWRixNQUFNQyxhQUFhLElBQUk5RSxHQUFKLEVBQW5CO0FBQ0E4RSxXQUFXekMsR0FBWCxDQUFldEYsU0FBU2dJLFNBQXhCLEVBQW1DQyxlQUFuQztBQUNBRixXQUFXekMsR0FBWCxDQUFlakYsU0FBUzJILFNBQXhCLEVBQW1DQyxlQUFuQztBQUNBRixXQUFXekMsR0FBWCxDQUFlNUUsU0FBU3NILFNBQXhCLEVBQW1DQyxlQUFuQztBQUNBRixXQUFXekMsR0FBWCxDQUFlaEYsV0FBVzBILFNBQTFCLEVBQXFDQyxpQkFBckM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZTlFLFFBQVF3SCxTQUF2QixFQUFrQ0MsY0FBbEM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZXRFLE1BQU1nSCxTQUFyQixFQUFnQ0MsWUFBaEM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZXpFLEtBQUttSCxTQUFwQixFQUErQkMsV0FBL0I7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZXJFLGVBQWUrRyxTQUE5QixFQUF5Q0MsZ0JBQXpDO0FBQ0FGLFdBQVd6QyxHQUFYLENBQWU0QyxPQUFPRixTQUF0QixFQUFpQ0MsYUFBakM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZW5GLE9BQU82SCxTQUF0QixFQUFpQ0MsYUFBakM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZXJDLElBQUkrRSxTQUFuQixFQUE4QkMsVUFBOUI7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZTFDLE1BQU1vRixTQUFyQixFQUFnQ0MsWUFBaEM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZTBCLE9BQU9nQixTQUF0QixFQUFpQ0MsYUFBakM7QUFDQUYsV0FBV3pDLEdBQVgsQ0FBZTZDLFFBQVFILFNBQXZCLEVBQWtDQyxjQUFsQztBQUNBRixXQUFXekMsR0FBWCxDQUFldkMsU0FBU2lGLFNBQXhCLEVBQW1DQyxlQUFuQztBQUNBRixXQUFXekMsR0FBWCxDQUFlSSxPQUFPc0MsU0FBdEIsRUFBaUNDLGFBQWpDOztBQUVBLEFBQU8sU0FBUzdELFVBQVQsQ0FBb0JmLE9BQXBCLEVBQTZCO01BQzlCQSxZQUFZLElBQWhCLEVBQXNCO1dBQ2I0RSxXQUFBLENBQXNCNUUsT0FBdEIsQ0FBUDs7O01BR0UsT0FBT0EsT0FBUCxLQUFtQixXQUF2QixFQUFvQztXQUMzQjRFLGVBQUEsQ0FBMEI1RSxPQUExQixDQUFQOzs7TUFHRSxPQUFPQSxPQUFQLEtBQW1CLFVBQXZCLEVBQW1DO1dBQzFCNEUsZUFBQSxDQUEwQjVFLE9BQTFCLENBQVA7OztRQUdJdkMsVUFBT3VDLFFBQVErRSxXQUFSLENBQW9CSixTQUFqQztRQUNNSyxXQUFXTixXQUFXeEMsR0FBWCxDQUFlekUsT0FBZixDQUFqQjs7TUFFSXVILFFBQUosRUFBYztXQUNMQSxTQUFTaEYsT0FBVCxDQUFQOzs7TUFHRSxPQUFPQSxPQUFQLEtBQW1CLFFBQXZCLEVBQWlDO1dBQ3hCNEUsYUFBQSxDQUF3QjVFLE9BQXhCLENBQVA7OztTQUdLNEUsY0FBQSxFQUFQOzs7QUNqREssTUFBTUssVUFBTixTQUF5QmhDLEtBQXpCLENBQStCO2NBQ3hCaUMsR0FBWixFQUFpQjs7O1FBR1gsT0FBT0EsR0FBUCxLQUFlLFFBQW5CLEVBQTZCO1dBQ3RCQyxPQUFMLEdBQWUsbUJBQW1CRCxJQUFJRSxRQUFKLEVBQWxDO0tBREYsTUFFTyxJQUFJN0YsTUFBTUMsT0FBTixDQUFjMEYsR0FBZCxDQUFKLEVBQXdCO1VBQ3pCRyxlQUFlSCxJQUFJMUQsR0FBSixDQUFRQyxLQUFLO1lBQzFCQSxNQUFNLElBQVYsRUFBZ0I7aUJBQ1AsTUFBUDtTQURGLE1BRU8sSUFBSSxPQUFPQSxDQUFQLEtBQWEsV0FBakIsRUFBOEI7aUJBQzVCLFdBQVA7OztlQUdLQSxFQUFFMkQsUUFBRixFQUFQO09BUGlCLENBQW5COztXQVVLRCxPQUFMLEdBQWUsbUJBQW1CRSxZQUFsQztLQVhLLE1BWUE7V0FDQUYsT0FBTCxHQUFlLG1CQUFtQkQsR0FBbEM7OztTQUdHdEksSUFBTCxHQUFZLEtBQUttSSxXQUFMLENBQWlCbkksSUFBN0I7Ozs7QUFJSixBQUFPLE1BQU0wSSxNQUFOLENBQWE7Y0FDTnRGLE9BQVosRUFBcUJ1RixFQUFyQixFQUF5QkMsUUFBUSxNQUFNLElBQXZDLEVBQTZDO1NBQ3RDeEYsT0FBTCxHQUFlZSxXQUFXZixPQUFYLENBQWY7U0FDS3lGLEtBQUwsR0FBYXpGLFFBQVFsQyxNQUFyQjtTQUNLNEgsU0FBTCxHQUFpQkMsa0JBQWtCM0YsT0FBbEIsQ0FBakI7U0FDS3VGLEVBQUwsR0FBVUEsRUFBVjtTQUNLQyxLQUFMLEdBQWFBLEtBQWI7Ozs7QUFJSixBQUFPLFNBQVNJLE1BQVQsQ0FBZ0I1RixPQUFoQixFQUF5QnVGLEVBQXpCLEVBQTZCQyxRQUFRLE1BQU0sSUFBM0MsRUFBaUQ7U0FDL0MsSUFBSUYsTUFBSixDQUFXdEYsT0FBWCxFQUFvQnVGLEVBQXBCLEVBQXdCQyxLQUF4QixDQUFQOzs7QUFHRjs7QUFVQSxBQUFPLFNBQVNLLFFBQVQsQ0FBa0IsR0FBR0MsT0FBckIsRUFBOEI7UUFDN0JDLFVBQVVDLFlBQVlGLE9BQVosQ0FBaEI7O1NBRU8sVUFBUyxHQUFHdEYsSUFBWixFQUFrQjtRQUNuQixDQUFDeUYsVUFBRCxFQUFhQyxNQUFiLElBQXVCQyxxQkFBcUIzRixJQUFyQixFQUEyQnVGLE9BQTNCLENBQTNCO1dBQ09FLFdBQVdwQyxLQUFYLENBQWlCLElBQWpCLEVBQXVCcUMsTUFBdkIsQ0FBUDtHQUZGOzs7QUFNRixBQUFPLFNBQVNFLFdBQVQsQ0FBcUIsR0FBR04sT0FBeEIsRUFBaUM7UUFDaENDLFVBQVVDLFlBQVlGLE9BQVosQ0FBaEI7O1NBRU8sV0FBVSxHQUFHdEYsSUFBYixFQUFtQjtRQUNwQixDQUFDeUYsVUFBRCxFQUFhQyxNQUFiLElBQXVCQyxxQkFBcUIzRixJQUFyQixFQUEyQnVGLE9BQTNCLENBQTNCO1dBQ08sT0FBT0UsV0FBV3BDLEtBQVgsQ0FBaUIsSUFBakIsRUFBdUJxQyxNQUF2QixDQUFkO0dBRkY7OztBQU1GLEFBQU8sU0FBU0csV0FBVCxDQUFxQixHQUFHN0YsSUFBeEIsRUFBOEI7U0FDNUI0RixZQUFZLEdBQUc1RixJQUFmLENBQVA7OztBQUdGLEFBQU8sU0FBUzhGLGFBQVQsQ0FBdUIsR0FBR1IsT0FBMUIsRUFBbUM7UUFDbENDLFVBQVVDLFlBQVlGLE9BQVosQ0FBaEI7O1NBRU8sZ0JBQWUsR0FBR3RGLElBQWxCLEVBQXdCO1FBQ3pCdUYsUUFBUTVELEdBQVIsQ0FBWTNCLEtBQUsxQyxNQUFqQixDQUFKLEVBQThCO1lBQ3RCeUksZUFBZVIsUUFBUTdELEdBQVIsQ0FBWTFCLEtBQUsxQyxNQUFqQixDQUFyQjs7VUFFSW1JLGFBQWEsSUFBakI7VUFDSUMsU0FBUyxJQUFiO1dBQ0ssSUFBSU0sZUFBVCxJQUE0QkQsWUFBNUIsRUFBMEM7WUFDcENFLFNBQVMsRUFBYjtlQUNPQyxxQkFDTGxHLElBREssRUFFTGdHLGdCQUFnQmYsS0FGWCxFQUdMZSxnQkFBZ0JkLFNBSFgsQ0FBUDs7Y0FNTWlCLFlBQVlILGdCQUFnQnhHLE9BQWhCLENBQXdCUSxJQUF4QixFQUE4QmlHLE1BQTlCLENBQWxCO2NBQ00sQ0FBQ0csY0FBRCxFQUFpQkMsYUFBakIsSUFBa0NDLG9CQUFvQkwsTUFBcEIsQ0FBeEM7O1lBR0VFLGFBQ0FFLGFBREEsS0FFQyxNQUFNTCxnQkFBZ0JoQixLQUFoQixDQUFzQjNCLEtBQXRCLENBQTRCLElBQTVCLEVBQWtDK0MsY0FBbEMsQ0FGUCxDQURGLEVBSUU7dUJBQ2FKLGdCQUFnQmpCLEVBQTdCO21CQUNTcUIsY0FBVDs7Ozs7VUFLQSxDQUFDWCxVQUFMLEVBQWlCO2dCQUNQYyxLQUFSLENBQWMsZUFBZCxFQUErQnZHLElBQS9CO2NBQ00sSUFBSXlFLFVBQUosQ0FBZXpFLElBQWYsQ0FBTjs7O2FBR0t5RixXQUFXcEMsS0FBWCxDQUFpQixJQUFqQixFQUF1QnFDLE1BQXZCLENBQVA7S0FoQ0YsTUFpQ087Y0FDR2EsS0FBUixDQUFjLFVBQWQsRUFBMEJ2RyxLQUFLMUMsTUFBL0IsRUFBdUMsMEJBQXZDLEVBQW1FMEMsSUFBbkU7WUFDTSxJQUFJeUUsVUFBSixDQUFlekUsSUFBZixDQUFOOztHQXBDSjs7O0FBeUNGLFNBQVMyRixvQkFBVCxDQUE4QjNGLElBQTlCLEVBQW9DdUYsT0FBcEMsRUFBNkM7TUFDdkNBLFFBQVE1RCxHQUFSLENBQVkzQixLQUFLMUMsTUFBakIsQ0FBSixFQUE4QjtVQUN0QnlJLGVBQWVSLFFBQVE3RCxHQUFSLENBQVkxQixLQUFLMUMsTUFBakIsQ0FBckI7O1FBRUltSSxhQUFhLElBQWpCO1FBQ0lDLFNBQVMsSUFBYjtTQUNLLElBQUlNLGVBQVQsSUFBNEJELFlBQTVCLEVBQTBDO1VBQ3BDRSxTQUFTLEVBQWI7YUFDT0MscUJBQ0xsRyxJQURLLEVBRUxnRyxnQkFBZ0JmLEtBRlgsRUFHTGUsZ0JBQWdCZCxTQUhYLENBQVA7O1lBTU1pQixZQUFZSCxnQkFBZ0J4RyxPQUFoQixDQUF3QlEsSUFBeEIsRUFBOEJpRyxNQUE5QixDQUFsQjtZQUNNLENBQUNHLGNBQUQsRUFBaUJDLGFBQWpCLElBQWtDQyxvQkFBb0JMLE1BQXBCLENBQXhDOztVQUdFRSxhQUNBRSxhQURBLElBRUFMLGdCQUFnQmhCLEtBQWhCLENBQXNCM0IsS0FBdEIsQ0FBNEIsSUFBNUIsRUFBa0MrQyxjQUFsQyxDQUhGLEVBSUU7cUJBQ2FKLGdCQUFnQmpCLEVBQTdCO2lCQUNTcUIsY0FBVDs7Ozs7UUFLQSxDQUFDWCxVQUFMLEVBQWlCO2NBQ1BjLEtBQVIsQ0FBYyxlQUFkLEVBQStCdkcsSUFBL0I7WUFDTSxJQUFJeUUsVUFBSixDQUFlekUsSUFBZixDQUFOOzs7V0FHSyxDQUFDeUYsVUFBRCxFQUFhQyxNQUFiLENBQVA7R0FoQ0YsTUFpQ087WUFDR2EsS0FBUixDQUFjLFVBQWQsRUFBMEJ2RyxLQUFLMUMsTUFBL0IsRUFBdUMsMEJBQXZDLEVBQW1FMEMsSUFBbkU7VUFDTSxJQUFJeUUsVUFBSixDQUFlekUsSUFBZixDQUFOOzs7O0FBSUosU0FBU3dGLFdBQVQsQ0FBcUJGLE9BQXJCLEVBQThCO01BQ3hCdEUsTUFBTSxJQUFJNUIsR0FBSixFQUFWOztPQUVLLE1BQU1nRyxNQUFYLElBQXFCRSxPQUFyQixFQUE4QjtVQUN0QmtCLFFBQVFDLGNBQWNyQixNQUFkLENBQWQ7O1NBRUssTUFBTUgsS0FBWCxJQUFvQnVCLEtBQXBCLEVBQTJCO1VBQ3JCVCxlQUFlLEVBQW5COztVQUVJL0UsSUFBSVcsR0FBSixDQUFRc0QsS0FBUixDQUFKLEVBQW9CO3VCQUNIakUsSUFBSVUsR0FBSixDQUFRdUQsS0FBUixDQUFmOzs7bUJBR1c5RSxJQUFiLENBQWtCaUYsTUFBbEI7VUFDSTNELEdBQUosQ0FBUXdELEtBQVIsRUFBZWMsWUFBZjs7OztTQUlHL0UsR0FBUDs7O0FBR0YsU0FBU3lGLGFBQVQsQ0FBdUJyQixNQUF2QixFQUErQjtRQUN2QnNCLE1BQU10QixPQUFPSCxLQUFQLEdBQWVHLE9BQU9GLFNBQVAsQ0FBaUI1SCxNQUE1QztRQUNNcUosTUFBTXZCLE9BQU9ILEtBQW5COztNQUVJdUIsUUFBUSxDQUFDRSxHQUFELENBQVo7O1NBRU9GLE1BQU1BLE1BQU1sSixNQUFOLEdBQWUsQ0FBckIsS0FBMkJxSixHQUFsQyxFQUF1QztVQUMvQnhHLElBQU4sQ0FBV3FHLE1BQU1BLE1BQU1sSixNQUFOLEdBQWUsQ0FBckIsSUFBMEIsQ0FBckM7OztTQUdLa0osS0FBUDs7O0FBR0YsU0FBU3JCLGlCQUFULENBQTJCM0YsT0FBM0IsRUFBb0M7TUFDOUIwRixZQUFZLEVBQWhCOztPQUVLLElBQUk5RCxJQUFJLENBQWIsRUFBZ0JBLElBQUk1QixRQUFRbEMsTUFBNUIsRUFBb0M4RCxHQUFwQyxFQUF5QztRQUVyQzVCLFFBQVE0QixDQUFSLGFBQXNCaEIsUUFBdEIsSUFDQVosUUFBUTRCLENBQVIsRUFBVy9FLGFBQVgsSUFBNEJDLE9BQU9DLEdBQVAsQ0FBVyxtQkFBWCxDQUY5QixFQUdFO2dCQUNVNEQsSUFBVixDQUFlLENBQUNpQixDQUFELEVBQUk1QixRQUFRNEIsQ0FBUixFQUFXL0UsYUFBZixDQUFmOzs7O1NBSUc2SSxTQUFQOzs7QUFHRixTQUFTZ0Isb0JBQVQsQ0FBOEJsRyxJQUE5QixFQUFvQ2lGLEtBQXBDLEVBQTJDQyxTQUEzQyxFQUFzRDtNQUNoRGxGLEtBQUsxQyxNQUFMLEtBQWdCMkgsS0FBaEIsSUFBeUJDLFVBQVU1SCxNQUFWLEtBQXFCLENBQWxELEVBQXFEO1dBQzVDMEMsSUFBUDs7O01BR0VBLEtBQUsxQyxNQUFMLEdBQWM0SCxVQUFVNUgsTUFBeEIsR0FBaUMySCxLQUFyQyxFQUE0QztXQUNuQ2pGLElBQVA7OztNQUdFNEcsMEJBQTBCM0IsUUFBUWpGLEtBQUsxQyxNQUEzQztNQUNJdUosb0JBQW9CM0IsVUFBVTVILE1BQVYsR0FBbUJzSix1QkFBM0M7O01BRUlFLGlCQUFpQjVCLFVBQVV6RSxLQUFWLENBQWdCb0csaUJBQWhCLENBQXJCOztPQUVLLElBQUksQ0FBQ2pKLEtBQUQsRUFBUWhCLEtBQVIsQ0FBVCxJQUEyQmtLLGNBQTNCLEVBQTJDO1NBQ3BDQyxNQUFMLENBQVluSixLQUFaLEVBQW1CLENBQW5CLEVBQXNCaEIsS0FBdEI7UUFDSW9ELEtBQUsxQyxNQUFMLEtBQWdCMkgsS0FBcEIsRUFBMkI7Ozs7O1NBS3RCakYsSUFBUDs7O0FBR0YsQUFBTyxTQUFTZ0gsS0FBVCxDQUFleEgsT0FBZixFQUF3QnlILElBQXhCLEVBQThCakMsUUFBUSxNQUFNLElBQTVDLEVBQWtEO01BQ25EaUIsU0FBUyxFQUFiO01BQ0lpQixtQkFBbUIzRyxXQUFXZixPQUFYLENBQXZCO1FBQ00yRyxZQUFZZSxpQkFBaUJELElBQWpCLEVBQXVCaEIsTUFBdkIsQ0FBbEI7UUFDTSxDQUFDRyxjQUFELEVBQWlCQyxhQUFqQixJQUFrQ0Msb0JBQW9CTCxNQUFwQixDQUF4Qzs7TUFFSUUsYUFBYUUsYUFBYixJQUE4QnJCLE1BQU0zQixLQUFOLENBQVksSUFBWixFQUFrQitDLGNBQWxCLENBQWxDLEVBQXFFO1dBQzVEQSxjQUFQO0dBREYsTUFFTztZQUNHRyxLQUFSLENBQWMsZUFBZCxFQUErQlUsSUFBL0I7VUFDTSxJQUFJeEMsVUFBSixDQUFld0MsSUFBZixDQUFOOzs7O0FBSUosU0FBU1gsbUJBQVQsQ0FBNkJhLE9BQTdCLEVBQXNDO1FBQzlCQyxXQUFXLEVBQWpCO1FBQ01DLGtCQUFrQixFQUF4Qjs7T0FFSyxJQUFJakcsSUFBSSxDQUFiLEVBQWdCQSxJQUFJK0YsUUFBUTdKLE1BQTVCLEVBQW9DOEQsR0FBcEMsRUFBeUM7VUFDakNrRyxVQUFVSCxRQUFRL0YsQ0FBUixDQUFoQjtRQUNJa0csbUJBQW1CbEgsbUJBQXZCLEVBQWtEO1VBQzVDZ0gsU0FBU0UsUUFBUWxMLElBQWpCLEtBQTBCZ0wsU0FBU0UsUUFBUWxMLElBQWpCLE1BQTJCa0wsUUFBUTFLLEtBQWpFLEVBQXdFO2VBQy9ELENBQUN1SyxPQUFELEVBQVUsS0FBVixDQUFQO09BREYsTUFFTyxJQUNMQyxTQUFTRSxRQUFRbEwsSUFBakIsS0FDQWdMLFNBQVNFLFFBQVFsTCxJQUFqQixNQUEyQmtMLFFBQVExSyxLQUY5QixFQUdMO3dCQUNnQnVELElBQWhCLENBQXFCbUgsUUFBUTFLLEtBQTdCO09BSkssTUFLQTtpQkFDSTBLLFFBQVFsTCxJQUFqQixJQUF5QmtMLFFBQVExSyxLQUFqQzt3QkFDZ0J1RCxJQUFoQixDQUFxQm1ILFFBQVExSyxLQUE3Qjs7S0FWSixNQVlPO3NCQUNXdUQsSUFBaEIsQ0FBcUJtSCxPQUFyQjs7OztTQUlHLENBQUNELGVBQUQsRUFBa0IsSUFBbEIsQ0FBUDs7O0FBR0YsQUFBTyxTQUFTRSxnQkFBVCxDQUNML0gsT0FESyxFQUVMeUgsSUFGSyxFQUdMakMsUUFBUSxNQUFNLElBSFQsRUFJTDNJLGdCQUFnQixJQUpYLEVBS0w7TUFDSTRKLFNBQVMsRUFBYjtNQUNJaUIsbUJBQW1CM0csV0FBV2YsT0FBWCxDQUF2QjtRQUNNMkcsWUFBWWUsaUJBQWlCRCxJQUFqQixFQUF1QmhCLE1BQXZCLENBQWxCO1FBQ00sQ0FBQ0csY0FBRCxFQUFpQkMsYUFBakIsSUFBa0NDLG9CQUFvQkwsTUFBcEIsQ0FBeEM7O01BRUlFLGFBQWFFLGFBQWIsSUFBOEJyQixNQUFNM0IsS0FBTixDQUFZLElBQVosRUFBa0IrQyxjQUFsQixDQUFsQyxFQUFxRTtXQUM1REEsY0FBUDtHQURGLE1BRU87V0FDRS9KLGFBQVA7Ozs7QUFJSixBQUFPLGVBQWVtTCxzQkFBZixDQUNMaEksT0FESyxFQUVMeUgsSUFGSyxFQUdMakMsUUFBUSxZQUFZLElBSGYsRUFJTDNJLGdCQUFnQixJQUpYLEVBS0w7TUFDSTRKLFNBQVMsRUFBYjtNQUNJaUIsbUJBQW1CM0csV0FBV2YsT0FBWCxDQUF2QjtRQUNNMkcsWUFBWWUsaUJBQWlCRCxJQUFqQixFQUF1QmhCLE1BQXZCLENBQWxCO1FBQ00sQ0FBQ0csY0FBRCxFQUFpQkMsYUFBakIsSUFBa0NDLG9CQUFvQkwsTUFBcEIsQ0FBeEM7UUFDTXRGLFVBQVV3RixhQUFhRSxhQUE3Qjs7TUFFSTFGLFlBQVksTUFBTXFFLE1BQU0zQixLQUFOLENBQVksSUFBWixFQUFrQitDLGNBQWxCLENBQWxCLENBQUosRUFBMEQ7V0FDakRBLGNBQVA7R0FERixNQUVPO1dBQ0UvSixhQUFQOzs7O0FDaFRKLE1BQU1vTCxXQUFXbkwsUUFBakI7O0FBRUEsQUFBTyxTQUFTb0wsbUJBQVQsQ0FBNkJsSSxPQUE3QixFQUFzQ21JLFNBQXRDLEVBQWlEO1NBQy9DLFlBQVc7UUFDWkMsZUFBZSxFQUFuQjtRQUNJQyxVQUFVRixVQUFVbEgsS0FBVixDQUFnQixDQUFoQixFQUFtQmpCLFFBQVFqQyxTQUFSLEVBQW5CLENBQWQ7UUFDSTZELElBQUksQ0FBUjs7V0FFT3lHLFFBQVF0SyxTQUFSLElBQXFCaUMsUUFBUWpDLFNBQVIsRUFBNUIsRUFBaUQ7WUFDekMwSSxTQUFTc0IsaUJBQWlCL0gsT0FBakIsRUFBMEJxSSxPQUExQixFQUFtQyxNQUFNLElBQXpDLEVBQStDSixRQUEvQyxDQUFmOztVQUVJeEIsVUFBVXdCLFFBQWQsRUFBd0I7Y0FDaEIsQ0FBQzdLLEtBQUQsSUFBVXFKLE1BQWhCO3FCQUNhOUYsSUFBYixDQUFrQjhGLE1BQWxCOzs7Z0JBR1EwQixVQUFVbEgsS0FBVixDQUNSakIsUUFBUWpDLFNBQVIsS0FBc0I2RCxDQURkLEVBRVI1QixRQUFRakMsU0FBUixNQUF1QjZELElBQUksQ0FBM0IsQ0FGUSxDQUFWOzs7OztXQVFLd0csWUFBUDtHQXJCRjs7O0FBeUJGLEFBQU8sU0FBU0UsY0FBVCxDQUF3QnRJLE9BQXhCLEVBQWlDdUksSUFBakMsRUFBdUM7U0FDckMsWUFBVztRQUNaSCxlQUFlLEVBQW5CO1NBQ0ssSUFBSXhHLENBQVQsSUFBYzJHLElBQWQsRUFBb0I7WUFDWjlCLFNBQVNzQixpQkFBaUIvSCxPQUFqQixFQUEwQjRCLENBQTFCLEVBQTZCLE1BQU0sSUFBbkMsRUFBeUNxRyxRQUF6QyxDQUFmO1VBQ0l4QixVQUFVd0IsUUFBZCxFQUF3QjtjQUNoQixDQUFDN0ssS0FBRCxJQUFVcUosTUFBaEI7cUJBQ2E5RixJQUFiLENBQWtCdkQsS0FBbEI7Ozs7V0FJR2dMLFlBQVA7R0FWRjs7O0FBY0YsQUFBTyxTQUFTSSxrQkFBVCxDQUE0QkMsVUFBNUIsRUFBd0NDLFVBQXhDLEVBQW9EO1FBQ25EQyxrQkFBa0JDLGVBQWVGLFdBQVdHLEdBQVgsSUFBZixFQUFtQ0gsVUFBbkMsQ0FBeEI7O01BRUlqQyxTQUFTLEVBQWI7O09BRUssSUFBSXJKLEtBQVQsSUFBa0J1TCxlQUFsQixFQUFtQztRQUM3QkYsV0FBV2pELEtBQVgsQ0FBaUIzQixLQUFqQixDQUF1QixJQUF2QixFQUE2QnpHLEtBQTdCLENBQUosRUFBeUM7YUFDaEN1RCxJQUFQLENBQVk4SCxXQUFXbEQsRUFBWCxDQUFjMUIsS0FBZCxDQUFvQixJQUFwQixFQUEwQnpHLEtBQTFCLENBQVo7Ozs7U0FJR3FKLE1BQVA7OztBQUdGLFNBQVNtQyxjQUFULENBQXdCRSxTQUF4QixFQUFtQ0osVUFBbkMsRUFBK0M7TUFDekNBLFdBQVc1SyxNQUFYLElBQXFCLENBQXpCLEVBQTRCO1dBQ25CZ0wsVUFBVXRILEdBQVYsQ0FBY0MsS0FBSztVQUNwQmxDLE1BQU1DLE9BQU4sQ0FBY2lDLENBQWQsQ0FBSixFQUFzQjtlQUNiQSxDQUFQO09BREYsTUFFTztlQUNFLENBQUNBLENBQUQsQ0FBUDs7S0FKRyxDQUFQO0dBREYsTUFRTztVQUNDOEcsT0FBT0csV0FBV0csR0FBWCxFQUFiOztRQUVJRSxXQUFXLEVBQWY7U0FDSyxJQUFJQyxDQUFULElBQWNULE1BQWQsRUFBc0I7V0FDZixJQUFJM0csQ0FBVCxJQUFja0gsU0FBZCxFQUF5QjtpQkFDZG5JLElBQVQsQ0FBYyxDQUFDcUksQ0FBRCxFQUFJMUcsTUFBSixDQUFXVixDQUFYLENBQWQ7Ozs7V0FJR2dILGVBQWVHLFFBQWYsRUFBeUJMLFVBQXpCLENBQVA7Ozs7QUFJSixBQUFPLFNBQVNPLHVCQUFULENBQWlDUixVQUFqQyxFQUE2Q0MsVUFBN0MsRUFBeUQ7UUFDeERDLGtCQUFrQkMsZUFBZUYsV0FBV0csR0FBWCxJQUFmLEVBQW1DSCxVQUFuQyxDQUF4Qjs7TUFFSWpDLFNBQVMsRUFBYjs7T0FFSyxJQUFJckosS0FBVCxJQUFrQnVMLGVBQWxCLEVBQW1DO1FBQzdCRixXQUFXakQsS0FBWCxDQUFpQjNCLEtBQWpCLENBQXVCLElBQXZCLEVBQTZCekcsS0FBN0IsQ0FBSixFQUF5QzthQUNoQ3VELElBQVAsQ0FBWThILFdBQVdsRCxFQUFYLENBQWMxQixLQUFkLENBQW9CLElBQXBCLEVBQTBCekcsS0FBMUIsQ0FBWjs7OztXQUlLcUosT0FBT2pGLEdBQVAsQ0FBV0MsS0FBSzNCLFlBQVlELFNBQVosQ0FBc0IyRSxPQUF0QixDQUE4Qi9DLENBQTlCLENBQWhCLENBQVQ7U0FDTyxJQUFJM0IsWUFBWUQsU0FBaEIsQ0FBMEIsR0FBRzRHLE1BQTdCLENBQVA7OztBQ2pFRixZQUFlO1VBQUE7T0FBQTtZQUFBO1VBQUE7VUFBQTtZQUFBO1NBQUE7VUFBQTtNQUFBO09BQUE7UUFBQTtRQUFBO2dCQUFBO2tCQUFBO3dCQUFBO2FBQUE7b0JBQUE7Z0JBQUE7cUJBQUE7eUJBQUE7YUFBQTs7Q0FBZjs7OzsifQ==
