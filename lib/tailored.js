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
  constructor() {}
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

function headTail() {
  return new HeadTail();
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
  return Object.prototype.toString.call(value) == '[object Function]';
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
    if (pattern.name === null || pattern.name.startsWith('_')) {
      args.push(value);
    } else {
      args.push(namedVariableResult(pattern.name, value));
    }

    return true;
  };
}

function resolveHeadTail() {
  return function (value, args) {
    if (!is_array(value) || value.length < 2) {
      return false;
    }

    const head = value[0];
    const tail = value.slice(1);

    args.push(head);
    args.push(tail);

    return true;
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

  const keys = pattern.keys();

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

    this.stack = new Error().stack;
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

        if (doesMatch && allNamesMatch && (await processedClause.guard.apply(this, result))) {
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
  defmatchgen,
  list_comprehension,
  list_generator,
  bitstring_generator,
  bitstring_comprehension,
  defmatchGen,
  defmatchAsync
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcykge1xuICByZXR1cm4gbmV3IEJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIG5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBOYW1lZFZhcmlhYmxlUmVzdWx0KG5hbWUsIHZhbHVlKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIE5hbWVkVmFyaWFibGVSZXN1bHQsXG4gIG5hbWVkVmFyaWFibGVSZXN1bHRcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2hcbn0gZnJvbSAnLi90eXBlcyc7XG5cbmZ1bmN0aW9uIGlzX251bWJlcih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNfc3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc191bmRlZmluZWQodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIGlzX29iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jztcbn1cblxuZnVuY3Rpb24gaXNfdmFyaWFibGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVmFyaWFibGU7XG59XG5cbmZ1bmN0aW9uIGlzX3dpbGRjYXJkKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFdpbGRjYXJkO1xufVxuXG5mdW5jdGlvbiBpc19oZWFkVGFpbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBIZWFkVGFpbDtcbn1cblxuZnVuY3Rpb24gaXNfY2FwdHVyZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBDYXB0dXJlO1xufVxuXG5mdW5jdGlvbiBpc190eXBlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFR5cGU7XG59XG5cbmZ1bmN0aW9uIGlzX3N0YXJ0c1dpdGgodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgU3RhcnRzV2l0aDtcbn1cblxuZnVuY3Rpb24gaXNfYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQm91bmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZnVuY3Rpb24gaXNfbnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzX2FycmF5KHZhbHVlKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gaXNfZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxuZnVuY3Rpb24gaXNfbWFwKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIE1hcDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZyxcbiAgaXNfbWFwXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChwYXR0ZXJuLm5hbWUgPT09IG51bGwgfHwgcGF0dGVybi5uYW1lLnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJncy5wdXNoKFR5cGVzLm5hbWVkVmFyaWFibGVSZXN1bHQocGF0dGVybi5uYW1lLCB2YWx1ZSkpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwoKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZCA9IHZhbHVlWzBdO1xuICAgIGNvbnN0IHRhaWwgPSB2YWx1ZS5zbGljZSgxKTtcblxuICAgIGFyZ3MucHVzaChoZWFkKTtcbiAgICBhcmdzLnB1c2godGFpbCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNhcHR1cmUocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLnZhbHVlKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAobWF0Y2hlcyh2YWx1ZSwgYXJncykpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmIHZhbHVlLnN0YXJ0c1dpdGgocHJlZml4KSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUeXBlKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKSB7XG4gICAgICBjb25zdCBtYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLm9ialBhdHRlcm4pO1xuICAgICAgcmV0dXJuIG1hdGNoZXModmFsdWUsIGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUFycmF5KHBhdHRlcm4pIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHBhdHRlcm4ubWFwKHggPT4gYnVpbGRNYXRjaCh4KSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCAhPSBwYXR0ZXJuLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVNYXAocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IG5ldyBNYXAoKTtcblxuICBjb25zdCBrZXlzID0gcGF0dGVybi5rZXlzKCk7XG5cbiAgZm9yIChsZXQga2V5IG9mIGtleXMpIHtcbiAgICBtYXRjaGVzLnNldChrZXksIGJ1aWxkTWF0Y2gocGF0dGVybi5nZXQoa2V5KSkpO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfbWFwKHZhbHVlKSB8fCBwYXR0ZXJuLnNpemUgPiB2YWx1ZS5zaXplKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yIChsZXQga2V5IG9mIGtleXMpIHtcbiAgICAgIGlmICghdmFsdWUuaGFzKGtleSkgfHwgIW1hdGNoZXMuZ2V0KGtleSkodmFsdWUuZ2V0KGtleSksIGFyZ3MpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU9iamVjdChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0ge307XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pXG4gICk7XG5cbiAgZm9yIChsZXQga2V5IG9mIGtleXMpIHtcbiAgICBtYXRjaGVzW2tleV0gPSBidWlsZE1hdGNoKHBhdHRlcm5ba2V5XSk7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yIChsZXQga2V5IG9mIGtleXMpIHtcbiAgICAgIGlmICghKGtleSBpbiB2YWx1ZSkgfHwgIW1hdGNoZXNba2V5XSh2YWx1ZVtrZXldLCBhcmdzKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCaXRTdHJpbmcocGF0dGVybikge1xuICBsZXQgcGF0dGVybkJpdFN0cmluZyA9IFtdO1xuXG4gIGZvciAobGV0IGJpdHN0cmluZ01hdGNoUGFydCBvZiBwYXR0ZXJuLnZhbHVlcykge1xuICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgbGV0IHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG4gICAgICBmaWxsQXJyYXkocGF0dGVybkJpdFN0cmluZywgc2l6ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhdHRlcm5CaXRTdHJpbmcgPSBwYXR0ZXJuQml0U3RyaW5nLmNvbmNhdChcbiAgICAgICAgbmV3IEJpdFN0cmluZyhiaXRzdHJpbmdNYXRjaFBhcnQpLnZhbHVlXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGxldCBwYXR0ZXJuVmFsdWVzID0gcGF0dGVybi52YWx1ZXM7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgbGV0IGJzVmFsdWUgPSBudWxsO1xuXG4gICAgaWYgKCFDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiAhKHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSkge1xuICAgICAgYnNWYWx1ZSA9IG5ldyBCaXRTdHJpbmcoQml0U3RyaW5nLmJpbmFyeSh2YWx1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBic1ZhbHVlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgbGV0IGJlZ2lubmluZ0luZGV4ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVyblZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGJpdHN0cmluZ01hdGNoUGFydCA9IHBhdHRlcm5WYWx1ZXNbaV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkgJiZcbiAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnR5cGUgPT0gJ2JpbmFyeScgJiZcbiAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICBpIDwgcGF0dGVyblZhbHVlcy5sZW5ndGggLSAxXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdhIGJpbmFyeSBmaWVsZCB3aXRob3V0IHNpemUgaXMgb25seSBhbGxvd2VkIGF0IHRoZSBlbmQgb2YgYSBiaW5hcnkgcGF0dGVybidcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHNpemUgPSAwO1xuICAgICAgbGV0IGJzVmFsdWVBcnJheVBhcnQgPSBbXTtcbiAgICAgIGxldCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gW107XG4gICAgICBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuXG4gICAgICBpZiAoaSA9PT0gcGF0dGVyblZhbHVlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplXG4gICAgICAgICk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKFxuICAgICAgICAgIGJlZ2lubmluZ0luZGV4LFxuICAgICAgICAgIGJlZ2lubmluZ0luZGV4ICsgc2l6ZVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpIHtcbiAgICAgICAgc3dpdGNoIChiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSkge1xuICAgICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcyAmJlxuICAgICAgICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcy5pbmRleE9mKCdzaWduZWQnKSAhPSAtMVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgSW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBVaW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdmbG9hdCc6XG4gICAgICAgICAgICBpZiAoc2l6ZSA9PT0gNjQpIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKEZsb2F0NjRBcnJheS5mcm9tKGJzVmFsdWVBcnJheVBhcnQpWzBdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2l6ZSA9PT0gMzIpIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKEZsb2F0MzJBcnJheS5mcm9tKGJzVmFsdWVBcnJheVBhcnQpWzBdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnYml0c3RyaW5nJzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChjcmVhdGVCaXRTdHJpbmcoYnNWYWx1ZUFycmF5UGFydCkpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmOCc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGYxNic6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQxNkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMzInOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MzJBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWFycmF5c0VxdWFsKGJzVmFsdWVBcnJheVBhcnQsIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgYmVnaW5uaW5nSW5kZXggPSBiZWdpbm5pbmdJbmRleCArIHNpemU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldFNpemUodW5pdCwgc2l6ZSkge1xuICByZXR1cm4gdW5pdCAqIHNpemUgLyA4O1xufVxuXG5mdW5jdGlvbiBhcnJheXNFcXVhbChhLCBiKSB7XG4gIGlmIChhID09PSBiKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgaWYgKGEubGVuZ3RoICE9IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBmaWxsQXJyYXkoYXJyLCBudW0pIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW07IGkrKykge1xuICAgIGFyci5wdXNoKDApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJpdFN0cmluZyhhcnIpIHtcbiAgbGV0IGludGVnZXJQYXJ0cyA9IGFyci5tYXAoZWxlbSA9PiBCaXRTdHJpbmcuaW50ZWdlcihlbGVtKSk7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nKC4uLmludGVnZXJQYXJ0cyk7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOb01hdGNoKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5leHBvcnQge1xuICByZXNvbHZlQm91bmQsXG4gIHJlc29sdmVXaWxkY2FyZCxcbiAgcmVzb2x2ZVZhcmlhYmxlLFxuICByZXNvbHZlSGVhZFRhaWwsXG4gIHJlc29sdmVDYXB0dXJlLFxuICByZXNvbHZlU3RhcnRzV2l0aCxcbiAgcmVzb2x2ZVR5cGUsXG4gIHJlc29sdmVBcnJheSxcbiAgcmVzb2x2ZU9iamVjdCxcbiAgcmVzb2x2ZU5vTWF0Y2gsXG4gIHJlc29sdmVTeW1ib2wsXG4gIHJlc29sdmVTdHJpbmcsXG4gIHJlc29sdmVOdW1iZXIsXG4gIHJlc29sdmVCb29sZWFuLFxuICByZXNvbHZlRnVuY3Rpb24sXG4gIHJlc29sdmVOdWxsLFxuICByZXNvbHZlQml0U3RyaW5nLFxuICByZXNvbHZlTWFwXG59O1xuIiwiaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gJy4vcmVzb2x2ZXJzJztcbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgcGF0dGVybk1hcCA9IG5ldyBNYXAoKTtcbnBhdHRlcm5NYXAuc2V0KFZhcmlhYmxlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZSk7XG5wYXR0ZXJuTWFwLnNldChXaWxkY2FyZC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQpO1xucGF0dGVybk1hcC5zZXQoSGVhZFRhaWwucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUhlYWRUYWlsKTtcbnBhdHRlcm5NYXAuc2V0KFN0YXJ0c1dpdGgucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN0YXJ0c1dpdGgpO1xucGF0dGVybk1hcC5zZXQoQ2FwdHVyZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQ2FwdHVyZSk7XG5wYXR0ZXJuTWFwLnNldChCb3VuZC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQm91bmQpO1xucGF0dGVybk1hcC5zZXQoVHlwZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlVHlwZSk7XG5wYXR0ZXJuTWFwLnNldChCaXRTdHJpbmdNYXRjaC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQml0U3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KE51bWJlci5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlTnVtYmVyKTtcbnBhdHRlcm5NYXAuc2V0KFN5bWJvbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKTtcbnBhdHRlcm5NYXAuc2V0KE1hcC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlTWFwKTtcbnBhdHRlcm5NYXAuc2V0KEFycmF5LnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVBcnJheSk7XG5wYXR0ZXJuTWFwLnNldChTdHJpbmcucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyk7XG5wYXR0ZXJuTWFwLnNldChCb29sZWFuLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKTtcbnBhdHRlcm5NYXAuc2V0KEZ1bmN0aW9uLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVGdW5jdGlvbik7XG5wYXR0ZXJuTWFwLnNldChPYmplY3QucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZU9iamVjdCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZE1hdGNoKHBhdHRlcm4pIHtcbiAgaWYgKHBhdHRlcm4gPT09IG51bGwpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOdWxsKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVdpbGRjYXJkKHBhdHRlcm4pO1xuICB9XG5cbiAgY29uc3QgdHlwZSA9IHBhdHRlcm4uY29uc3RydWN0b3IucHJvdG90eXBlO1xuICBjb25zdCByZXNvbHZlciA9IHBhdHRlcm5NYXAuZ2V0KHR5cGUpO1xuXG4gIGlmIChyZXNvbHZlcikge1xuICAgIHJldHVybiByZXNvbHZlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgRlVOQyA9IFN5bWJvbCgpO1xuXG5leHBvcnQgY2xhc3MgTWF0Y2hFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoYXJnKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnc3ltYm9sJykge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICBsZXQgbWFwcGVkVmFsdWVzID0gYXJnLm1hcCh4ID0+IHtcbiAgICAgICAgaWYgKHggPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB4ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB4LnRvU3RyaW5nKCk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIG1hcHBlZFZhbHVlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZztcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrID0gbmV3IEVycm9yKCkuc3RhY2s7XG4gICAgdGhpcy5uYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGF1c2Uge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmFyaXR5ID0gcGF0dGVybi5sZW5ndGg7XG4gICAgdGhpcy5vcHRpb25hbHMgPSBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICByZXR1cm4gbmV3IENsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbXBvbGluZShmbikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJlcyA9IGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgd2hpbGUgKHJlcyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXMgPSByZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoZ2VuKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiooLi4uYXJncykge1xuICAgIGxldCBbZnVuY1RvQ2FsbCwgcGFyYW1zXSA9IGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpO1xuICAgIHJldHVybiB5aWVsZCogZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hHZW4oLi4uYXJncykge1xuICByZXR1cm4gZGVmbWF0Y2hnZW4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEFzeW5jKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBhc3luYyBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgICAgYXJncyxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCk7XG4gICAgICAgIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGRvZXNNYXRjaCAmJlxuICAgICAgICAgIGFsbE5hbWVzTWF0Y2ggJiZcbiAgICAgICAgICAoYXdhaXQgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpXG4gICAgICAgICkge1xuICAgICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgICAgcGFyYW1zID0gcmVzdWx0O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpIHtcbiAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgIGNvbnN0IGFyaXR5Q2xhdXNlcyA9IGFyaXRpZXMuZ2V0KGFyZ3MubGVuZ3RoKTtcblxuICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgYXJpdHlDbGF1c2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgKTtcblxuICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgIGFsbE5hbWVzTWF0Y2ggJiZcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KVxuICAgICAgKSB7XG4gICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgIHBhcmFtcyA9IGZpbHRlcmVkUmVzdWx0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBbZnVuY1RvQ2FsbCwgcGFyYW1zXTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXJpdHlNYXAoY2xhdXNlcykge1xuICBsZXQgbWFwID0gbmV3IE1hcCgpO1xuXG4gIGZvciAoY29uc3QgY2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICBjb25zdCByYW5nZSA9IGdldEFyaXR5UmFuZ2UoY2xhdXNlKTtcblxuICAgIGZvciAoY29uc3QgYXJpdHkgb2YgcmFuZ2UpIHtcbiAgICAgIGxldCBhcml0eUNsYXVzZXMgPSBbXTtcblxuICAgICAgaWYgKG1hcC5oYXMoYXJpdHkpKSB7XG4gICAgICAgIGFyaXR5Q2xhdXNlcyA9IG1hcC5nZXQoYXJpdHkpO1xuICAgICAgfVxuXG4gICAgICBhcml0eUNsYXVzZXMucHVzaChjbGF1c2UpO1xuICAgICAgbWFwLnNldChhcml0eSwgYXJpdHlDbGF1c2VzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBnZXRBcml0eVJhbmdlKGNsYXVzZSkge1xuICBjb25zdCBtaW4gPSBjbGF1c2UuYXJpdHkgLSBjbGF1c2Uub3B0aW9uYWxzLmxlbmd0aDtcbiAgY29uc3QgbWF4ID0gY2xhdXNlLmFyaXR5O1xuXG4gIGxldCByYW5nZSA9IFttaW5dO1xuXG4gIHdoaWxlIChyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSAhPSBtYXgpIHtcbiAgICByYW5nZS5wdXNoKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICsgMSk7XG4gIH1cblxuICByZXR1cm4gcmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pIHtcbiAgbGV0IG9wdGlvbmFscyA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKykge1xuICAgIGlmIChcbiAgICAgIHBhdHRlcm5baV0gaW5zdGFuY2VvZiBUeXBlcy5WYXJpYWJsZSAmJlxuICAgICAgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlICE9IFN5bWJvbC5mb3IoJ3RhaWxvcmVkLm5vX3ZhbHVlJylcbiAgICApIHtcbiAgICAgIG9wdGlvbmFscy5wdXNoKFtpLCBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWVdKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3B0aW9uYWxzO1xufVxuXG5mdW5jdGlvbiBmaWxsSW5PcHRpb25hbFZhbHVlcyhhcmdzLCBhcml0eSwgb3B0aW9uYWxzKSB7XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkgfHwgb3B0aW9uYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgaWYgKGFyZ3MubGVuZ3RoICsgb3B0aW9uYWxzLmxlbmd0aCA8IGFyaXR5KSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBsZXQgbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwgPSBhcml0eSAtIGFyZ3MubGVuZ3RoO1xuICBsZXQgb3B0aW9uYWxzVG9SZW1vdmUgPSBvcHRpb25hbHMubGVuZ3RoIC0gbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGw7XG5cbiAgbGV0IG9wdGlvbmFsc1RvVXNlID0gb3B0aW9uYWxzLnNsaWNlKG9wdGlvbmFsc1RvUmVtb3ZlKTtcblxuICBmb3IgKGxldCBbaW5kZXgsIHZhbHVlXSBvZiBvcHRpb25hbHNUb1VzZSkge1xuICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAwLCB2YWx1ZSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaChwYXR0ZXJuLCBleHByLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KTtcbiAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICBpZiAoZG9lc01hdGNoICYmIGFsbE5hbWVzTWF0Y2ggJiYgZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKSB7XG4gICAgcmV0dXJuIGZpbHRlcmVkUmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBleHByKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihleHByKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdHMpIHtcbiAgY29uc3QgbmFtZXNNYXAgPSB7fTtcbiAgY29uc3QgZmlsdGVyZWRSZXN1bHRzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHJlc3VsdHNbaV07XG4gICAgaWYgKGN1cnJlbnQgaW5zdGFuY2VvZiBUeXBlcy5OYW1lZFZhcmlhYmxlUmVzdWx0KSB7XG4gICAgICBpZiAobmFtZXNNYXBbY3VycmVudC5uYW1lXSAmJiBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICE9PSBjdXJyZW50LnZhbHVlKSB7XG4gICAgICAgIHJldHVybiBbcmVzdWx0cywgZmFsc2VdO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgbmFtZXNNYXBbY3VycmVudC5uYW1lXSAmJlxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdID09PSBjdXJyZW50LnZhbHVlXG4gICAgICApIHtcbiAgICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdID0gY3VycmVudC52YWx1ZTtcbiAgICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudC52YWx1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKGN1cnJlbnQpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBbZmlsdGVyZWRSZXN1bHRzLCB0cnVlXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGxcbikge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gIGlmIChkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaCAmJiBndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdCkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcblxuY29uc3QgTk9fTUFUQ0ggPSBTeW1ib2woKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19nZW5lcmF0b3IocGF0dGVybiwgYml0c3RyaW5nKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgbGV0IGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoMCwgcGF0dGVybi5ieXRlX3NpemUoKSk7XG4gICAgbGV0IGkgPSAxO1xuXG4gICAgd2hpbGUgKGJzU2xpY2UuYnl0ZV9zaXplID09IHBhdHRlcm4uYnl0ZV9zaXplKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgYnNTbGljZSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiBpLFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogKGkgKyAxKVxuICAgICAgKTtcblxuICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2dlbmVyYXRvcihwYXR0ZXJuLCBsaXN0KSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgZm9yIChsZXQgaSBvZiBsaXN0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGksICgpID0+IHRydWUsIE5PX01BVENIKTtcbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3IsIGdlbmVyYXRvcnMpIHtcbiAgaWYgKGdlbmVyYXRvcnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yLm1hcCh4ID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgICAgIHJldHVybiB4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFt4XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsaXN0ID0gZ2VuZXJhdG9ycy5wb3AoKTtcblxuICAgIGxldCBuZXh0X2dlbiA9IFtdO1xuICAgIGZvciAobGV0IGogb2YgbGlzdCgpKSB7XG4gICAgICBmb3IgKGxldCBpIG9mIGdlbmVyYXRvcikge1xuICAgICAgICBuZXh0X2dlbi5wdXNoKFtqXS5jb25jYXQoaSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBydW5fZ2VuZXJhdG9ycyhuZXh0X2dlbiwgZ2VuZXJhdG9ycyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmVzdWx0ID0gcmVzdWx0Lm1hcCh4ID0+IEVybGFuZ1R5cGVzLkJpdFN0cmluZy5pbnRlZ2VyKHgpKTtcbiAgcmV0dXJuIG5ldyBFcmxhbmdUeXBlcy5CaXRTdHJpbmcoLi4ucmVzdWx0KTtcbn1cbiIsImltcG9ydCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luYyxcbn0gZnJvbSAnLi90YWlsb3JlZC9kZWZtYXRjaCc7XG5pbXBvcnQge1xuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdGFpbG9yZWQvdHlwZXMnO1xuXG5pbXBvcnQge1xuICBsaXN0X2dlbmVyYXRvcixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbn0gZnJvbSAnLi90YWlsb3JlZC9jb21wcmVoZW5zaW9ucyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIGJpdFN0cmluZ01hdGNoLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBkZWZtYXRjaGdlbixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBsaXN0X2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufTtcbiJdLCJuYW1lcyI6WyJWYXJpYWJsZSIsIm5hbWUiLCJkZWZhdWx0X3ZhbHVlIiwiU3ltYm9sIiwiZm9yIiwiV2lsZGNhcmQiLCJTdGFydHNXaXRoIiwicHJlZml4IiwiQ2FwdHVyZSIsInZhbHVlIiwiSGVhZFRhaWwiLCJUeXBlIiwidHlwZSIsIm9ialBhdHRlcm4iLCJCb3VuZCIsIkJpdFN0cmluZ01hdGNoIiwidmFsdWVzIiwibGVuZ3RoIiwiYnl0ZV9zaXplIiwicyIsInZhbCIsInVuaXQiLCJzaXplIiwiaW5kZXgiLCJnZXRWYWx1ZSIsIk5hbWVkVmFyaWFibGVSZXN1bHQiLCJ2YXJpYWJsZSIsIndpbGRjYXJkIiwic3RhcnRzV2l0aCIsImNhcHR1cmUiLCJoZWFkVGFpbCIsImJvdW5kIiwiYml0U3RyaW5nTWF0Y2giLCJuYW1lZFZhcmlhYmxlUmVzdWx0IiwiaXNfbnVtYmVyIiwiaXNfc3RyaW5nIiwiaXNfYm9vbGVhbiIsImlzX3N5bWJvbCIsImlzX29iamVjdCIsImlzX3ZhcmlhYmxlIiwiaXNfbnVsbCIsImlzX2FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiaXNfZnVuY3Rpb24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsImNhbGwiLCJpc19tYXAiLCJNYXAiLCJCaXRTdHJpbmciLCJFcmxhbmdUeXBlcyIsInJlc29sdmVTeW1ib2wiLCJwYXR0ZXJuIiwiQ2hlY2tzIiwicmVzb2x2ZVN0cmluZyIsInJlc29sdmVOdW1iZXIiLCJyZXNvbHZlQm9vbGVhbiIsInJlc29sdmVGdW5jdGlvbiIsInJlc29sdmVOdWxsIiwicmVzb2x2ZUJvdW5kIiwiYXJncyIsInJlc29sdmVXaWxkY2FyZCIsInJlc29sdmVWYXJpYWJsZSIsInB1c2giLCJUeXBlcyIsInJlc29sdmVIZWFkVGFpbCIsImhlYWQiLCJ0YWlsIiwic2xpY2UiLCJyZXNvbHZlQ2FwdHVyZSIsIm1hdGNoZXMiLCJidWlsZE1hdGNoIiwicmVzb2x2ZVN0YXJ0c1dpdGgiLCJzdWJzdHJpbmciLCJyZXNvbHZlVHlwZSIsInJlc29sdmVBcnJheSIsIm1hcCIsIngiLCJldmVyeSIsInYiLCJpIiwicmVzb2x2ZU1hcCIsImtleXMiLCJrZXkiLCJzZXQiLCJnZXQiLCJoYXMiLCJyZXNvbHZlT2JqZWN0IiwiY29uY2F0IiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwicmVzb2x2ZUJpdFN0cmluZyIsInBhdHRlcm5CaXRTdHJpbmciLCJiaXRzdHJpbmdNYXRjaFBhcnQiLCJnZXRTaXplIiwicGF0dGVyblZhbHVlcyIsImJzVmFsdWUiLCJiaW5hcnkiLCJiZWdpbm5pbmdJbmRleCIsInVuZGVmaW5lZCIsIkVycm9yIiwiYnNWYWx1ZUFycmF5UGFydCIsInBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQiLCJhdHRyaWJ1dGVzIiwiaW5kZXhPZiIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJGbG9hdDY0QXJyYXkiLCJmcm9tIiwiRmxvYXQzMkFycmF5IiwiY3JlYXRlQml0U3RyaW5nIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiYXBwbHkiLCJVaW50MTZBcnJheSIsIlVpbnQzMkFycmF5IiwiYXJyYXlzRXF1YWwiLCJhIiwiYiIsImZpbGxBcnJheSIsImFyciIsIm51bSIsImludGVnZXJQYXJ0cyIsImVsZW0iLCJpbnRlZ2VyIiwicmVzb2x2ZU5vTWF0Y2giLCJwYXR0ZXJuTWFwIiwiUmVzb2x2ZXJzIiwiTnVtYmVyIiwiQm9vbGVhbiIsIkZ1bmN0aW9uIiwiY29uc3RydWN0b3IiLCJyZXNvbHZlciIsIk1hdGNoRXJyb3IiLCJhcmciLCJtZXNzYWdlIiwibWFwcGVkVmFsdWVzIiwic3RhY2siLCJDbGF1c2UiLCJmbiIsImd1YXJkIiwiYXJpdHkiLCJvcHRpb25hbHMiLCJnZXRPcHRpb25hbFZhbHVlcyIsImNsYXVzZSIsImRlZm1hdGNoIiwiY2xhdXNlcyIsImFyaXRpZXMiLCJnZXRBcml0eU1hcCIsImZ1bmNUb0NhbGwiLCJwYXJhbXMiLCJmaW5kTWF0Y2hpbmdGdW5jdGlvbiIsImRlZm1hdGNoZ2VuIiwiZGVmbWF0Y2hHZW4iLCJkZWZtYXRjaEFzeW5jIiwiYXJpdHlDbGF1c2VzIiwicHJvY2Vzc2VkQ2xhdXNlIiwicmVzdWx0IiwiZmlsbEluT3B0aW9uYWxWYWx1ZXMiLCJkb2VzTWF0Y2giLCJmaWx0ZXJlZFJlc3VsdCIsImFsbE5hbWVzTWF0Y2giLCJjaGVja05hbWVkVmFyaWFibGVzIiwiZXJyb3IiLCJyYW5nZSIsImdldEFyaXR5UmFuZ2UiLCJtaW4iLCJtYXgiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwicmVzdWx0cyIsIm5hbWVzTWFwIiwiZmlsdGVyZWRSZXN1bHRzIiwiY3VycmVudCIsIm1hdGNoX29yX2RlZmF1bHQiLCJOT19NQVRDSCIsImJpdHN0cmluZ19nZW5lcmF0b3IiLCJiaXRzdHJpbmciLCJyZXR1cm5SZXN1bHQiLCJic1NsaWNlIiwibGlzdF9nZW5lcmF0b3IiLCJsaXN0IiwibGlzdF9jb21wcmVoZW5zaW9uIiwiZXhwcmVzc2lvbiIsImdlbmVyYXRvcnMiLCJnZW5lcmF0ZWRWYWx1ZXMiLCJydW5fZ2VuZXJhdG9ycyIsInBvcCIsImdlbmVyYXRvciIsIm5leHRfZ2VuIiwiaiIsImJpdHN0cmluZ19jb21wcmVoZW5zaW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7QUFFQSxNQUFNQSxRQUFOLENBQWU7Y0FDREMsT0FBTyxJQUFuQixFQUF5QkMsZ0JBQWdCQyxPQUFPQyxHQUFQLENBQVcsbUJBQVgsQ0FBekMsRUFBMEU7U0FDbkVILElBQUwsR0FBWUEsSUFBWjtTQUNLQyxhQUFMLEdBQXFCQSxhQUFyQjs7OztBQUlKLE1BQU1HLFFBQU4sQ0FBZTtnQkFDQzs7O0FBR2hCLE1BQU1DLFVBQU4sQ0FBaUI7Y0FDSEMsTUFBWixFQUFvQjtTQUNiQSxNQUFMLEdBQWNBLE1BQWQ7Ozs7QUFJSixNQUFNQyxPQUFOLENBQWM7Y0FDQUMsS0FBWixFQUFtQjtTQUNaQSxLQUFMLEdBQWFBLEtBQWI7Ozs7QUFJSixNQUFNQyxRQUFOLENBQWU7Z0JBQ0M7OztBQUdoQixNQUFNQyxJQUFOLENBQVc7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
