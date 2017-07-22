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
    if (pattern.name === null) {
      args.push(value);
    } else if (!pattern.name.startsWith('_')) {
      args.push(namedVariableResult(pattern.name, value));
    }

    return true;
  };
}

function resolveHeadTail() {
  return function (value, args) {
    if (!is_array(value) || value.length === 0) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcykge1xuICByZXR1cm4gbmV3IEJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIG5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBOYW1lZFZhcmlhYmxlUmVzdWx0KG5hbWUsIHZhbHVlKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIE5hbWVkVmFyaWFibGVSZXN1bHQsXG4gIG5hbWVkVmFyaWFibGVSZXN1bHRcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2hcbn0gZnJvbSAnLi90eXBlcyc7XG5cbmZ1bmN0aW9uIGlzX251bWJlcih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNfc3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc191bmRlZmluZWQodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIGlzX29iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jztcbn1cblxuZnVuY3Rpb24gaXNfdmFyaWFibGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVmFyaWFibGU7XG59XG5cbmZ1bmN0aW9uIGlzX3dpbGRjYXJkKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFdpbGRjYXJkO1xufVxuXG5mdW5jdGlvbiBpc19oZWFkVGFpbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBIZWFkVGFpbDtcbn1cblxuZnVuY3Rpb24gaXNfY2FwdHVyZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBDYXB0dXJlO1xufVxuXG5mdW5jdGlvbiBpc190eXBlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFR5cGU7XG59XG5cbmZ1bmN0aW9uIGlzX3N0YXJ0c1dpdGgodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgU3RhcnRzV2l0aDtcbn1cblxuZnVuY3Rpb24gaXNfYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQm91bmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZnVuY3Rpb24gaXNfbnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzX2FycmF5KHZhbHVlKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gaXNfZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxuZnVuY3Rpb24gaXNfbWFwKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIE1hcDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZyxcbiAgaXNfbWFwXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChwYXR0ZXJuLm5hbWUgPT09IG51bGwpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgfSBlbHNlIGlmICghcGF0dGVybi5uYW1lLnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgYXJncy5wdXNoKFR5cGVzLm5hbWVkVmFyaWFibGVSZXN1bHQocGF0dGVybi5uYW1lLCB2YWx1ZSkpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwoKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChtYXRjaGVzKHZhbHVlLCBhcmdzKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybikge1xuICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnByZWZpeDtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVR5cGUocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpIHtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoICE9IHBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU1hcChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0IGtleXMgPSBBcnJheS5mcm9tKHBhdHRlcm4ua2V5cygpKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXMuc2V0KGtleSwgYnVpbGRNYXRjaChwYXR0ZXJuLmdldChrZXkpKSk7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19tYXAodmFsdWUpIHx8IHBhdHRlcm4uc2l6ZSA+IHZhbHVlLnNpemUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCF2YWx1ZS5oYXMoa2V5KSB8fCAhbWF0Y2hlcy5nZXQoa2V5KSh2YWx1ZS5nZXQoa2V5KSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlT2JqZWN0KHBhdHRlcm4pIHtcbiAgbGV0IG1hdGNoZXMgPSB7fTtcblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocGF0dGVybikuY29uY2F0KFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocGF0dGVybilcbiAgKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCEoa2V5IGluIHZhbHVlKSB8fCAhbWF0Y2hlc1trZXldKHZhbHVlW2tleV0sIGFyZ3MpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJpdFN0cmluZyhwYXR0ZXJuKSB7XG4gIGxldCBwYXR0ZXJuQml0U3RyaW5nID0gW107XG5cbiAgZm9yIChsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0IG9mIHBhdHRlcm4udmFsdWVzKSB7XG4gICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICBsZXQgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcbiAgICAgIGZpbGxBcnJheShwYXR0ZXJuQml0U3RyaW5nLCBzaXplKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0dGVybkJpdFN0cmluZyA9IHBhdHRlcm5CaXRTdHJpbmcuY29uY2F0KFxuICAgICAgICBuZXcgQml0U3RyaW5nKGJpdHN0cmluZ01hdGNoUGFydCkudmFsdWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmIChpID09PSBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmcsXG4gIHJlc29sdmVNYXBcbn07XG4iLCJpbXBvcnQgKiBhcyBSZXNvbHZlcnMgZnJvbSAnLi9yZXNvbHZlcnMnO1xuaW1wb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBIZWFkVGFpbCxcbiAgQ2FwdHVyZSxcbiAgVHlwZSxcbiAgU3RhcnRzV2l0aCxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoXG59IGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBwYXR0ZXJuTWFwID0gbmV3IE1hcCgpO1xucGF0dGVybk1hcC5zZXQoVmFyaWFibGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlKTtcbnBhdHRlcm5NYXAuc2V0KFdpbGRjYXJkLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCk7XG5wYXR0ZXJuTWFwLnNldChIZWFkVGFpbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwpO1xucGF0dGVybk1hcC5zZXQoU3RhcnRzV2l0aC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aCk7XG5wYXR0ZXJuTWFwLnNldChDYXB0dXJlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKTtcbnBhdHRlcm5NYXAuc2V0KEJvdW5kLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb3VuZCk7XG5wYXR0ZXJuTWFwLnNldChUeXBlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVUeXBlKTtcbnBhdHRlcm5NYXAuc2V0KEJpdFN0cmluZ01hdGNoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoTnVtYmVyLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIpO1xucGF0dGVybk1hcC5zZXQoU3ltYm9sLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wpO1xucGF0dGVybk1hcC5zZXQoTWFwLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVNYXApO1xucGF0dGVybk1hcC5zZXQoQXJyYXkucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUFycmF5KTtcbnBhdHRlcm5NYXAuc2V0KFN0cmluZy5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KEJvb2xlYW4ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvb2xlYW4pO1xucGF0dGVybk1hcC5zZXQoRnVuY3Rpb24ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUZ1bmN0aW9uKTtcbnBhdHRlcm5NYXAuc2V0KE9iamVjdC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWF0Y2gocGF0dGVybikge1xuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBjb25zdCB0eXBlID0gcGF0dGVybi5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG4gIGNvbnN0IHJlc29sdmVyID0gcGF0dGVybk1hcC5nZXQodHlwZSk7XG5cbiAgaWYgKHJlc29sdmVyKSB7XG4gICAgcmV0dXJuIHJlc29sdmVyKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU9iamVjdChwYXR0ZXJuKTtcbiAgfVxuXG4gIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU5vTWF0Y2goKTtcbn1cbiIsImltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tICcuL21hdGNoJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBGVU5DID0gU3ltYm9sKCk7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhcmcpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnKSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKHggPT4ge1xuICAgICAgICBpZiAoeCA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmV0dXJuICd1bmRlZmluZWQnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHgudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgICBhcmdzLFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcykge1xuICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgYXJncyxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICApO1xuXG4gICAgICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpO1xuICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgaWYgKFxuICAgICAgICBkb2VzTWF0Y2ggJiZcbiAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpXG4gICAgICApIHtcbiAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgcGFyYW1zID0gZmlsdGVyZWRSZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtmdW5jVG9DYWxsLCBwYXJhbXNdO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcml0eU1hcChjbGF1c2VzKSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgZm9yIChjb25zdCBjbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgIGNvbnN0IHJhbmdlID0gZ2V0QXJpdHlSYW5nZShjbGF1c2UpO1xuXG4gICAgZm9yIChjb25zdCBhcml0eSBvZiByYW5nZSkge1xuICAgICAgbGV0IGFyaXR5Q2xhdXNlcyA9IFtdO1xuXG4gICAgICBpZiAobWFwLmhhcyhhcml0eSkpIHtcbiAgICAgICAgYXJpdHlDbGF1c2VzID0gbWFwLmdldChhcml0eSk7XG4gICAgICB9XG5cbiAgICAgIGFyaXR5Q2xhdXNlcy5wdXNoKGNsYXVzZSk7XG4gICAgICBtYXAuc2V0KGFyaXR5LCBhcml0eUNsYXVzZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5UmFuZ2UoY2xhdXNlKSB7XG4gIGNvbnN0IG1pbiA9IGNsYXVzZS5hcml0eSAtIGNsYXVzZS5vcHRpb25hbHMubGVuZ3RoO1xuICBjb25zdCBtYXggPSBjbGF1c2UuYXJpdHk7XG5cbiAgbGV0IHJhbmdlID0gW21pbl07XG5cbiAgd2hpbGUgKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICE9IG1heCkge1xuICAgIHJhbmdlLnB1c2gocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gKyAxKTtcbiAgfVxuXG4gIHJldHVybiByYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuICAgICkge1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSB8fCBvcHRpb25hbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZiAoYXJncy5sZW5ndGggKyBvcHRpb25hbHMubGVuZ3RoIDwgYXJpdHkpIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGxldCBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCA9IGFyaXR5IC0gYXJncy5sZW5ndGg7XG4gIGxldCBvcHRpb25hbHNUb1JlbW92ZSA9IG9wdGlvbmFscy5sZW5ndGggLSBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbDtcblxuICBsZXQgb3B0aW9uYWxzVG9Vc2UgPSBvcHRpb25hbHMuc2xpY2Uob3B0aW9uYWxzVG9SZW1vdmUpO1xuXG4gIGZvciAobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKSB7XG4gICAgYXJncy5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gIGlmIChkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaCAmJiBndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdCkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0cykge1xuICBjb25zdCBuYW1lc01hcCA9IHt9O1xuICBjb25zdCBmaWx0ZXJlZFJlc3VsdHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcmVzdWx0c1tpXTtcbiAgICBpZiAoY3VycmVudCBpbnN0YW5jZW9mIFR5cGVzLk5hbWVkVmFyaWFibGVSZXN1bHQpIHtcbiAgICAgIGlmIChuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gIT09IGN1cnJlbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIFtyZXN1bHRzLCBmYWxzZV07XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmXG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPT09IGN1cnJlbnQudmFsdWVcbiAgICAgICkge1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPSBjdXJyZW50LnZhbHVlO1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFtmaWx0ZXJlZFJlc3VsdHMsIHRydWVdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hfb3JfZGVmYXVsdChcbiAgcGF0dGVybixcbiAgZXhwcixcbiAgZ3VhcmQgPSAoKSA9PiB0cnVlLFxuICBkZWZhdWx0X3ZhbHVlID0gbnVsbFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgaWYgKGRvZXNNYXRjaCAmJiBhbGxOYW1lc01hdGNoICYmIGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgbWF0Y2hfb3JfZGVmYXVsdCB9IGZyb20gXCIuL2RlZm1hdGNoXCI7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSBcImVybGFuZy10eXBlc1wiO1xuXG5jb25zdCBOT19NQVRDSCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2dlbmVyYXRvcihwYXR0ZXJuLCBiaXRzdHJpbmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBsZXQgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZSgwLCBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKTtcbiAgICBsZXQgaSA9IDE7XG5cbiAgICB3aGlsZSAoYnNTbGljZS5ieXRlX3NpemUgPT0gcGF0dGVybi5ieXRlX3NpemUoKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBic1NsaWNlLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZShcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIGksXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiAoaSArIDEpXG4gICAgICApO1xuXG4gICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfZ2VuZXJhdG9yKHBhdHRlcm4sIGxpc3QpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpIG9mIGxpc3QpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgaSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvciwgZ2VuZXJhdG9ycykge1xuICBpZiAoZ2VuZXJhdG9ycy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBnZW5lcmF0b3IubWFwKHggPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoeCkpIHtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW3hdO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxpc3QgPSBnZW5lcmF0b3JzLnBvcCgpO1xuXG4gICAgbGV0IG5leHRfZ2VuID0gW107XG4gICAgZm9yIChsZXQgaiBvZiBsaXN0KCkpIHtcbiAgICAgIGZvciAobGV0IGkgb2YgZ2VuZXJhdG9yKSB7XG4gICAgICAgIG5leHRfZ2VuLnB1c2goW2pdLmNvbmNhdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJ1bl9nZW5lcmF0b3JzKG5leHRfZ2VuLCBnZW5lcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXN1bHQgPSByZXN1bHQubWFwKHggPT4gRXJsYW5nVHlwZXMuQml0U3RyaW5nLmludGVnZXIoeCkpO1xuICByZXR1cm4gbmV3IEVybGFuZ1R5cGVzLkJpdFN0cmluZyguLi5yZXN1bHQpO1xufVxuIiwiaW1wb3J0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufSBmcm9tICcuL3RhaWxvcmVkL2RlZm1hdGNoJztcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbn0gZnJvbSAnLi90YWlsb3JlZC90eXBlcyc7XG5cbmltcG9ydCB7XG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxufSBmcm9tICcuL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zJztcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmMsXG59O1xuIl0sIm5hbWVzIjpbIlZhcmlhYmxlIiwibmFtZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsIlR5cGUiLCJ0eXBlIiwib2JqUGF0dGVybiIsIkJvdW5kIiwiQml0U3RyaW5nTWF0Y2giLCJ2YWx1ZXMiLCJsZW5ndGgiLCJieXRlX3NpemUiLCJzIiwidmFsIiwidW5pdCIsInNpemUiLCJpbmRleCIsImdldFZhbHVlIiwiTmFtZWRWYXJpYWJsZVJlc3VsdCIsInZhcmlhYmxlIiwid2lsZGNhcmQiLCJzdGFydHNXaXRoIiwiY2FwdHVyZSIsImhlYWRUYWlsIiwiYm91bmQiLCJiaXRTdHJpbmdNYXRjaCIsIm5hbWVkVmFyaWFibGVSZXN1bHQiLCJpc19udW1iZXIiLCJpc19zdHJpbmciLCJpc19ib29sZWFuIiwiaXNfc3ltYm9sIiwiaXNfb2JqZWN0IiwiaXNfdmFyaWFibGUiLCJpc19udWxsIiwiaXNfYXJyYXkiLCJBcnJheSIsImlzQXJyYXkiLCJpc19mdW5jdGlvbiIsIk9iamVjdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCIsImlzX21hcCIsIk1hcCIsIkJpdFN0cmluZyIsIkVybGFuZ1R5cGVzIiwicmVzb2x2ZVN5bWJvbCIsInBhdHRlcm4iLCJDaGVja3MiLCJyZXNvbHZlU3RyaW5nIiwicmVzb2x2ZU51bWJlciIsInJlc29sdmVCb29sZWFuIiwicmVzb2x2ZUZ1bmN0aW9uIiwicmVzb2x2ZU51bGwiLCJyZXNvbHZlQm91bmQiLCJhcmdzIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicHVzaCIsIlR5cGVzIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlTWFwIiwia2V5cyIsImZyb20iLCJrZXkiLCJzZXQiLCJnZXQiLCJoYXMiLCJyZXNvbHZlT2JqZWN0IiwiY29uY2F0IiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwicmVzb2x2ZUJpdFN0cmluZyIsInBhdHRlcm5CaXRTdHJpbmciLCJiaXRzdHJpbmdNYXRjaFBhcnQiLCJnZXRTaXplIiwicGF0dGVyblZhbHVlcyIsImJzVmFsdWUiLCJiaW5hcnkiLCJiZWdpbm5pbmdJbmRleCIsInVuZGVmaW5lZCIsIkVycm9yIiwiYnNWYWx1ZUFycmF5UGFydCIsInBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQiLCJhdHRyaWJ1dGVzIiwiaW5kZXhPZiIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJGbG9hdDY0QXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJjcmVhdGVCaXRTdHJpbmciLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJhcHBseSIsIlVpbnQxNkFycmF5IiwiVWludDMyQXJyYXkiLCJhcnJheXNFcXVhbCIsImEiLCJiIiwiZmlsbEFycmF5IiwiYXJyIiwibnVtIiwiaW50ZWdlclBhcnRzIiwiZWxlbSIsImludGVnZXIiLCJyZXNvbHZlTm9NYXRjaCIsInBhdHRlcm5NYXAiLCJSZXNvbHZlcnMiLCJOdW1iZXIiLCJCb29sZWFuIiwiRnVuY3Rpb24iLCJjb25zdHJ1Y3RvciIsInJlc29sdmVyIiwiTWF0Y2hFcnJvciIsImFyZyIsIm1lc3NhZ2UiLCJtYXBwZWRWYWx1ZXMiLCJzdGFjayIsIkNsYXVzZSIsImZuIiwiZ3VhcmQiLCJhcml0eSIsIm9wdGlvbmFscyIsImdldE9wdGlvbmFsVmFsdWVzIiwiY2xhdXNlIiwiZGVmbWF0Y2giLCJjbGF1c2VzIiwiYXJpdGllcyIsImdldEFyaXR5TWFwIiwiZnVuY1RvQ2FsbCIsInBhcmFtcyIsImZpbmRNYXRjaGluZ0Z1bmN0aW9uIiwiZGVmbWF0Y2hnZW4iLCJkZWZtYXRjaEdlbiIsImRlZm1hdGNoQXN5bmMiLCJhcml0eUNsYXVzZXMiLCJwcm9jZXNzZWRDbGF1c2UiLCJyZXN1bHQiLCJmaWxsSW5PcHRpb25hbFZhbHVlcyIsImRvZXNNYXRjaCIsImZpbHRlcmVkUmVzdWx0IiwiYWxsTmFtZXNNYXRjaCIsImNoZWNrTmFtZWRWYXJpYWJsZXMiLCJlcnJvciIsInJhbmdlIiwiZ2V0QXJpdHlSYW5nZSIsIm1pbiIsIm1heCIsIm51bWJlck9mT3B0aW9uYWxzVG9GaWxsIiwib3B0aW9uYWxzVG9SZW1vdmUiLCJvcHRpb25hbHNUb1VzZSIsInNwbGljZSIsIm1hdGNoIiwiZXhwciIsInByb2Nlc3NlZFBhdHRlcm4iLCJyZXN1bHRzIiwibmFtZXNNYXAiLCJmaWx0ZXJlZFJlc3VsdHMiLCJjdXJyZW50IiwibWF0Y2hfb3JfZGVmYXVsdCIsIk5PX01BVENIIiwiYml0c3RyaW5nX2dlbmVyYXRvciIsImJpdHN0cmluZyIsInJldHVyblJlc3VsdCIsImJzU2xpY2UiLCJsaXN0X2dlbmVyYXRvciIsImxpc3QiLCJsaXN0X2NvbXByZWhlbnNpb24iLCJleHByZXNzaW9uIiwiZ2VuZXJhdG9ycyIsImdlbmVyYXRlZFZhbHVlcyIsInJ1bl9nZW5lcmF0b3JzIiwicG9wIiwiZ2VuZXJhdG9yIiwibmV4dF9nZW4iLCJqIiwiYml0c3RyaW5nX2NvbXByZWhlbnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUVBLE1BQU1BLFFBQU4sQ0FBZTtjQUNEQyxPQUFPLElBQW5CLEVBQXlCQyxnQkFBZ0JDLE9BQU9DLEdBQVAsQ0FBVyxtQkFBWCxDQUF6QyxFQUEwRTtTQUNuRUgsSUFBTCxHQUFZQSxJQUFaO1NBQ0tDLGFBQUwsR0FBcUJBLGFBQXJCOzs7O0FBSUosTUFBTUcsUUFBTixDQUFlO2dCQUNDOzs7QUFHaEIsTUFBTUMsVUFBTixDQUFpQjtjQUNIQyxNQUFaLEVBQW9CO1NBQ2JBLE1BQUwsR0FBY0EsTUFBZDs7OztBQUlKLE1BQU1DLE9BQU4sQ0FBYztjQUNBQyxLQUFaLEVBQW1CO1NBQ1pBLEtBQUwsR0FBYUEsS0FBYjs7OztBQUlKLE1BQU1DLFFBQU4sQ0FBZTtnQkFDQzs7O0FBR2hC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
