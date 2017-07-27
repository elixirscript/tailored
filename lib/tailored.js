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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoaGVhZCwgdGFpbCkge1xuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgfVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKGhlYWQsIHRhaWwpIHtcbiAgcmV0dXJuIG5ldyBIZWFkVGFpbChoZWFkLCB0YWlsKTtcbn1cblxuZnVuY3Rpb24gdHlwZSh0eXBlLCBvYmpQYXR0ZXJuID0ge30pIHtcbiAgcmV0dXJuIG5ldyBUeXBlKHR5cGUsIG9ialBhdHRlcm4pO1xufVxuXG5mdW5jdGlvbiBib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gbmV3IEJvdW5kKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gYml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKSB7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gbmFtZWRWYXJpYWJsZVJlc3VsdChuYW1lLCB2YWx1ZSkge1xuICByZXR1cm4gbmV3IE5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpO1xufVxuXG5leHBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIFN0YXJ0c1dpdGgsXG4gIENhcHR1cmUsXG4gIEhlYWRUYWlsLFxuICBUeXBlLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgTmFtZWRWYXJpYWJsZVJlc3VsdCxcbiAgbmFtZWRWYXJpYWJsZVJlc3VsdFxufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3R5cGVzJztcblxuZnVuY3Rpb24gaXNfbnVtYmVyKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc19zdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG5cbmZ1bmN0aW9uIGlzX2Jvb2xlYW4odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nO1xufVxuXG5mdW5jdGlvbiBpc19zeW1ib2wodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCc7XG59XG5cbmZ1bmN0aW9uIGlzX3VuZGVmaW5lZCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJztcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfYml0c3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJpdFN0cmluZ01hdGNoO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfYXJyYXkodmFsdWUpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc19tYXAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgTWFwO1xufVxuXG5leHBvcnQge1xuICBpc19udW1iZXIsXG4gIGlzX3N0cmluZyxcbiAgaXNfYm9vbGVhbixcbiAgaXNfc3ltYm9sLFxuICBpc19udWxsLFxuICBpc191bmRlZmluZWQsXG4gIGlzX2Z1bmN0aW9uLFxuICBpc192YXJpYWJsZSxcbiAgaXNfd2lsZGNhcmQsXG4gIGlzX2hlYWRUYWlsLFxuICBpc19jYXB0dXJlLFxuICBpc190eXBlLFxuICBpc19zdGFydHNXaXRoLFxuICBpc19ib3VuZCxcbiAgaXNfb2JqZWN0LFxuICBpc19hcnJheSxcbiAgaXNfYml0c3RyaW5nLFxuICBpc19tYXBcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgKiBhcyBDaGVja3MgZnJvbSAnLi9jaGVja3MnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSAnZXJsYW5nLXR5cGVzJztcbmNvbnN0IEJpdFN0cmluZyA9IEVybGFuZ1R5cGVzLkJpdFN0cmluZztcblxuZnVuY3Rpb24gcmVzb2x2ZVN5bWJvbChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfc3ltYm9sKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0cmluZyhwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfbnVtYmVyKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvb2xlYW4ocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Jvb2xlYW4odmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlRnVuY3Rpb24ocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bGwodmFsdWUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQm91bmQocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSB0eXBlb2YgcGF0dGVybi52YWx1ZSAmJiB2YWx1ZSA9PT0gcGF0dGVybi52YWx1ZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlV2lsZGNhcmQoKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHBhdHRlcm4ubmFtZSA9PT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKCFwYXR0ZXJuLm5hbWUuc3RhcnRzV2l0aCgnXycpKSB7XG4gICAgICBhcmdzLnB1c2goVHlwZXMubmFtZWRWYXJpYWJsZVJlc3VsdChwYXR0ZXJuLm5hbWUsIHZhbHVlKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVIZWFkVGFpbChwYXR0ZXJuKSB7XG4gIGNvbnN0IGhlYWRNYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLmhlYWQpO1xuICBjb25zdCB0YWlsTWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi50YWlsKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZCA9IHZhbHVlWzBdO1xuICAgIGNvbnN0IHRhaWwgPSB2YWx1ZS5zbGljZSgxKTtcblxuICAgIGlmIChoZWFkTWF0Y2hlcyhoZWFkLCBhcmdzKSAmJiB0YWlsTWF0Y2hlcyh0YWlsLCBhcmdzKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChtYXRjaGVzKHZhbHVlLCBhcmdzKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybikge1xuICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnByZWZpeDtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVR5cGUocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpIHtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoICE9IHBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU1hcChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0IGtleXMgPSBBcnJheS5mcm9tKHBhdHRlcm4ua2V5cygpKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXMuc2V0KGtleSwgYnVpbGRNYXRjaChwYXR0ZXJuLmdldChrZXkpKSk7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19tYXAodmFsdWUpIHx8IHBhdHRlcm4uc2l6ZSA+IHZhbHVlLnNpemUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCF2YWx1ZS5oYXMoa2V5KSB8fCAhbWF0Y2hlcy5nZXQoa2V5KSh2YWx1ZS5nZXQoa2V5KSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlT2JqZWN0KHBhdHRlcm4pIHtcbiAgbGV0IG1hdGNoZXMgPSB7fTtcblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocGF0dGVybikuY29uY2F0KFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocGF0dGVybilcbiAgKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCEoa2V5IGluIHZhbHVlKSB8fCAhbWF0Y2hlc1trZXldKHZhbHVlW2tleV0sIGFyZ3MpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJpdFN0cmluZyhwYXR0ZXJuKSB7XG4gIGxldCBwYXR0ZXJuQml0U3RyaW5nID0gW107XG5cbiAgZm9yIChsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0IG9mIHBhdHRlcm4udmFsdWVzKSB7XG4gICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICBsZXQgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcbiAgICAgIGZpbGxBcnJheShwYXR0ZXJuQml0U3RyaW5nLCBzaXplKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0dGVybkJpdFN0cmluZyA9IHBhdHRlcm5CaXRTdHJpbmcuY29uY2F0KFxuICAgICAgICBuZXcgQml0U3RyaW5nKGJpdHN0cmluZ01hdGNoUGFydCkudmFsdWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmIChpID09PSBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmcsXG4gIHJlc29sdmVNYXBcbn07XG4iLCJpbXBvcnQgKiBhcyBSZXNvbHZlcnMgZnJvbSAnLi9yZXNvbHZlcnMnO1xuaW1wb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBIZWFkVGFpbCxcbiAgQ2FwdHVyZSxcbiAgVHlwZSxcbiAgU3RhcnRzV2l0aCxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoXG59IGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBwYXR0ZXJuTWFwID0gbmV3IE1hcCgpO1xucGF0dGVybk1hcC5zZXQoVmFyaWFibGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlKTtcbnBhdHRlcm5NYXAuc2V0KFdpbGRjYXJkLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCk7XG5wYXR0ZXJuTWFwLnNldChIZWFkVGFpbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwpO1xucGF0dGVybk1hcC5zZXQoU3RhcnRzV2l0aC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aCk7XG5wYXR0ZXJuTWFwLnNldChDYXB0dXJlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKTtcbnBhdHRlcm5NYXAuc2V0KEJvdW5kLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb3VuZCk7XG5wYXR0ZXJuTWFwLnNldChUeXBlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVUeXBlKTtcbnBhdHRlcm5NYXAuc2V0KEJpdFN0cmluZ01hdGNoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoTnVtYmVyLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIpO1xucGF0dGVybk1hcC5zZXQoU3ltYm9sLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wpO1xucGF0dGVybk1hcC5zZXQoTWFwLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVNYXApO1xucGF0dGVybk1hcC5zZXQoQXJyYXkucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUFycmF5KTtcbnBhdHRlcm5NYXAuc2V0KFN0cmluZy5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KEJvb2xlYW4ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvb2xlYW4pO1xucGF0dGVybk1hcC5zZXQoRnVuY3Rpb24ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUZ1bmN0aW9uKTtcbnBhdHRlcm5NYXAuc2V0KE9iamVjdC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWF0Y2gocGF0dGVybikge1xuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBjb25zdCB0eXBlID0gcGF0dGVybi5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG4gIGNvbnN0IHJlc29sdmVyID0gcGF0dGVybk1hcC5nZXQodHlwZSk7XG5cbiAgaWYgKHJlc29sdmVyKSB7XG4gICAgcmV0dXJuIHJlc29sdmVyKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU9iamVjdChwYXR0ZXJuKTtcbiAgfVxuXG4gIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU5vTWF0Y2goKTtcbn1cbiIsImltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tICcuL21hdGNoJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBGVU5DID0gU3ltYm9sKCk7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhcmcpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnKSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKHggPT4ge1xuICAgICAgICBpZiAoeCA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmV0dXJuICd1bmRlZmluZWQnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHgudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgICBhcmdzLFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcykge1xuICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgYXJncyxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICApO1xuXG4gICAgICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpO1xuICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgaWYgKFxuICAgICAgICBkb2VzTWF0Y2ggJiZcbiAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpXG4gICAgICApIHtcbiAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgcGFyYW1zID0gZmlsdGVyZWRSZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtmdW5jVG9DYWxsLCBwYXJhbXNdO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcml0eU1hcChjbGF1c2VzKSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgZm9yIChjb25zdCBjbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgIGNvbnN0IHJhbmdlID0gZ2V0QXJpdHlSYW5nZShjbGF1c2UpO1xuXG4gICAgZm9yIChjb25zdCBhcml0eSBvZiByYW5nZSkge1xuICAgICAgbGV0IGFyaXR5Q2xhdXNlcyA9IFtdO1xuXG4gICAgICBpZiAobWFwLmhhcyhhcml0eSkpIHtcbiAgICAgICAgYXJpdHlDbGF1c2VzID0gbWFwLmdldChhcml0eSk7XG4gICAgICB9XG5cbiAgICAgIGFyaXR5Q2xhdXNlcy5wdXNoKGNsYXVzZSk7XG4gICAgICBtYXAuc2V0KGFyaXR5LCBhcml0eUNsYXVzZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5UmFuZ2UoY2xhdXNlKSB7XG4gIGNvbnN0IG1pbiA9IGNsYXVzZS5hcml0eSAtIGNsYXVzZS5vcHRpb25hbHMubGVuZ3RoO1xuICBjb25zdCBtYXggPSBjbGF1c2UuYXJpdHk7XG5cbiAgbGV0IHJhbmdlID0gW21pbl07XG5cbiAgd2hpbGUgKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICE9IG1heCkge1xuICAgIHJhbmdlLnB1c2gocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gKyAxKTtcbiAgfVxuXG4gIHJldHVybiByYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuICAgICkge1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSB8fCBvcHRpb25hbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZiAoYXJncy5sZW5ndGggKyBvcHRpb25hbHMubGVuZ3RoIDwgYXJpdHkpIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGxldCBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCA9IGFyaXR5IC0gYXJncy5sZW5ndGg7XG4gIGxldCBvcHRpb25hbHNUb1JlbW92ZSA9IG9wdGlvbmFscy5sZW5ndGggLSBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbDtcblxuICBsZXQgb3B0aW9uYWxzVG9Vc2UgPSBvcHRpb25hbHMuc2xpY2Uob3B0aW9uYWxzVG9SZW1vdmUpO1xuXG4gIGZvciAobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKSB7XG4gICAgYXJncy5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gIGlmIChkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaCAmJiBndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdCkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0cykge1xuICBjb25zdCBuYW1lc01hcCA9IHt9O1xuICBjb25zdCBmaWx0ZXJlZFJlc3VsdHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcmVzdWx0c1tpXTtcbiAgICBpZiAoY3VycmVudCBpbnN0YW5jZW9mIFR5cGVzLk5hbWVkVmFyaWFibGVSZXN1bHQpIHtcbiAgICAgIGlmIChuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gIT09IGN1cnJlbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIFtyZXN1bHRzLCBmYWxzZV07XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICYmXG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPT09IGN1cnJlbnQudmFsdWVcbiAgICAgICkge1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5hbWVzTWFwW2N1cnJlbnQubmFtZV0gPSBjdXJyZW50LnZhbHVlO1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChjdXJyZW50LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFtmaWx0ZXJlZFJlc3VsdHMsIHRydWVdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hfb3JfZGVmYXVsdChcbiAgcGF0dGVybixcbiAgZXhwcixcbiAgZ3VhcmQgPSAoKSA9PiB0cnVlLFxuICBkZWZhdWx0X3ZhbHVlID0gbnVsbFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBjb25zdCBkb2VzTWF0Y2ggPSBwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCk7XG4gIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgaWYgKGRvZXNNYXRjaCAmJiBhbGxOYW1lc01hdGNoICYmIGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkge1xuICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgbWF0Y2hfb3JfZGVmYXVsdCB9IGZyb20gXCIuL2RlZm1hdGNoXCI7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSBcImVybGFuZy10eXBlc1wiO1xuXG5jb25zdCBOT19NQVRDSCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2dlbmVyYXRvcihwYXR0ZXJuLCBiaXRzdHJpbmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBsZXQgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZSgwLCBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKTtcbiAgICBsZXQgaSA9IDE7XG5cbiAgICB3aGlsZSAoYnNTbGljZS5ieXRlX3NpemUgPT0gcGF0dGVybi5ieXRlX3NpemUoKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBic1NsaWNlLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZShcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIGksXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiAoaSArIDEpXG4gICAgICApO1xuXG4gICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfZ2VuZXJhdG9yKHBhdHRlcm4sIGxpc3QpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpIG9mIGxpc3QpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgaSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvciwgZ2VuZXJhdG9ycykge1xuICBpZiAoZ2VuZXJhdG9ycy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBnZW5lcmF0b3IubWFwKHggPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoeCkpIHtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW3hdO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxpc3QgPSBnZW5lcmF0b3JzLnBvcCgpO1xuXG4gICAgbGV0IG5leHRfZ2VuID0gW107XG4gICAgZm9yIChsZXQgaiBvZiBsaXN0KCkpIHtcbiAgICAgIGZvciAobGV0IGkgb2YgZ2VuZXJhdG9yKSB7XG4gICAgICAgIG5leHRfZ2VuLnB1c2goW2pdLmNvbmNhdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJ1bl9nZW5lcmF0b3JzKG5leHRfZ2VuLCBnZW5lcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXN1bHQgPSByZXN1bHQubWFwKHggPT4gRXJsYW5nVHlwZXMuQml0U3RyaW5nLmludGVnZXIoeCkpO1xuICByZXR1cm4gbmV3IEVybGFuZ1R5cGVzLkJpdFN0cmluZyguLi5yZXN1bHQpO1xufVxuIiwiaW1wb3J0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufSBmcm9tICcuL3RhaWxvcmVkL2RlZm1hdGNoJztcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbn0gZnJvbSAnLi90YWlsb3JlZC90eXBlcyc7XG5cbmltcG9ydCB7XG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxufSBmcm9tICcuL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zJztcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmMsXG59O1xuIl0sIm5hbWVzIjpbIlZhcmlhYmxlIiwibmFtZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsImhlYWQiLCJ0YWlsIiwiVHlwZSIsInR5cGUiLCJvYmpQYXR0ZXJuIiwiQm91bmQiLCJCaXRTdHJpbmdNYXRjaCIsInZhbHVlcyIsImxlbmd0aCIsImJ5dGVfc2l6ZSIsInMiLCJ2YWwiLCJ1bml0Iiwic2l6ZSIsImluZGV4IiwiZ2V0VmFsdWUiLCJOYW1lZFZhcmlhYmxlUmVzdWx0IiwidmFyaWFibGUiLCJ3aWxkY2FyZCIsInN0YXJ0c1dpdGgiLCJjYXB0dXJlIiwiaGVhZFRhaWwiLCJib3VuZCIsImJpdFN0cmluZ01hdGNoIiwibmFtZWRWYXJpYWJsZVJlc3VsdCIsImlzX251bWJlciIsImlzX3N0cmluZyIsImlzX2Jvb2xlYW4iLCJpc19zeW1ib2wiLCJpc19vYmplY3QiLCJpc192YXJpYWJsZSIsImlzX251bGwiLCJpc19hcnJheSIsIkFycmF5IiwiaXNBcnJheSIsImlzX2Z1bmN0aW9uIiwiT2JqZWN0IiwicHJvdG90eXBlIiwidG9TdHJpbmciLCJjYWxsIiwiaXNfbWFwIiwiTWFwIiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlRnVuY3Rpb24iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJyZXNvbHZlV2lsZGNhcmQiLCJyZXNvbHZlVmFyaWFibGUiLCJwdXNoIiwiVHlwZXMiLCJyZXNvbHZlSGVhZFRhaWwiLCJoZWFkTWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJ0YWlsTWF0Y2hlcyIsInNsaWNlIiwicmVzb2x2ZUNhcHR1cmUiLCJtYXRjaGVzIiwicmVzb2x2ZVN0YXJ0c1dpdGgiLCJzdWJzdHJpbmciLCJyZXNvbHZlVHlwZSIsInJlc29sdmVBcnJheSIsIm1hcCIsIngiLCJldmVyeSIsInYiLCJpIiwicmVzb2x2ZU1hcCIsImtleXMiLCJmcm9tIiwia2V5Iiwic2V0IiwiZ2V0IiwiaGFzIiwicmVzb2x2ZU9iamVjdCIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiRmxvYXQzMkFycmF5IiwiY3JlYXRlQml0U3RyaW5nIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiYXBwbHkiLCJVaW50MTZBcnJheSIsIlVpbnQzMkFycmF5IiwiYXJyYXlzRXF1YWwiLCJhIiwiYiIsImZpbGxBcnJheSIsImFyciIsIm51bSIsImludGVnZXJQYXJ0cyIsImVsZW0iLCJpbnRlZ2VyIiwicmVzb2x2ZU5vTWF0Y2giLCJwYXR0ZXJuTWFwIiwiUmVzb2x2ZXJzIiwiTnVtYmVyIiwiQm9vbGVhbiIsIkZ1bmN0aW9uIiwiY29uc3RydWN0b3IiLCJyZXNvbHZlciIsIk1hdGNoRXJyb3IiLCJhcmciLCJtZXNzYWdlIiwibWFwcGVkVmFsdWVzIiwic3RhY2siLCJDbGF1c2UiLCJmbiIsImd1YXJkIiwiYXJpdHkiLCJvcHRpb25hbHMiLCJnZXRPcHRpb25hbFZhbHVlcyIsImNsYXVzZSIsImRlZm1hdGNoIiwiY2xhdXNlcyIsImFyaXRpZXMiLCJnZXRBcml0eU1hcCIsImZ1bmNUb0NhbGwiLCJwYXJhbXMiLCJmaW5kTWF0Y2hpbmdGdW5jdGlvbiIsImRlZm1hdGNoZ2VuIiwiZGVmbWF0Y2hHZW4iLCJkZWZtYXRjaEFzeW5jIiwiYXJpdHlDbGF1c2VzIiwicHJvY2Vzc2VkQ2xhdXNlIiwicmVzdWx0IiwiZmlsbEluT3B0aW9uYWxWYWx1ZXMiLCJkb2VzTWF0Y2giLCJmaWx0ZXJlZFJlc3VsdCIsImFsbE5hbWVzTWF0Y2giLCJjaGVja05hbWVkVmFyaWFibGVzIiwiZXJyb3IiLCJyYW5nZSIsImdldEFyaXR5UmFuZ2UiLCJtaW4iLCJtYXgiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwicmVzdWx0cyIsIm5hbWVzTWFwIiwiZmlsdGVyZWRSZXN1bHRzIiwiY3VycmVudCIsIm1hdGNoX29yX2RlZmF1bHQiLCJOT19NQVRDSCIsImJpdHN0cmluZ19nZW5lcmF0b3IiLCJiaXRzdHJpbmciLCJyZXR1cm5SZXN1bHQiLCJic1NsaWNlIiwibGlzdF9nZW5lcmF0b3IiLCJsaXN0IiwibGlzdF9jb21wcmVoZW5zaW9uIiwiZXhwcmVzc2lvbiIsImdlbmVyYXRvcnMiLCJnZW5lcmF0ZWRWYWx1ZXMiLCJydW5fZ2VuZXJhdG9ycyIsInBvcCIsImdlbmVyYXRvciIsIm5leHRfZ2VuIiwiaiIsImJpdHN0cmluZ19jb21wcmVoZW5zaW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7QUFFQSxNQUFNQSxRQUFOLENBQWU7Y0FDREMsT0FBTyxJQUFuQixFQUF5QkMsZ0JBQWdCQyxPQUFPQyxHQUFQLENB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
