'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ErlangTypes = _interopDefault(require('erlang-types'));

/* @flow */

class Variable {

  constructor(default_value = Symbol.for("tailored.no_value")) {
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

function variable(default_value = Symbol.for("tailored.no_value")) {
  return new Variable(default_value);
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

function resolveVariable() {
  return function (value, args) {
    args.push(value);
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

        if (processedClause.pattern(args, result) && (await processedClause.guard.apply(this, result))) {
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

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
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
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    console.error('No match for:', expr);
    throw new MatchError(expr);
  }
}

function match_or_default(pattern, expr, guard = () => true, default_value = null) {
  let result = [];
  let processedPattern = buildMatch(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbn1cblxuZnVuY3Rpb24gaXNfYm9vbGVhbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbic7XG59XG5cbmZ1bmN0aW9uIGlzX3N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3ltYm9sJztcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19vYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG5cbmZ1bmN0aW9uIGlzX3ZhcmlhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFZhcmlhYmxlO1xufVxuXG5mdW5jdGlvbiBpc193aWxkY2FyZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXaWxkY2FyZDtcbn1cblxuZnVuY3Rpb24gaXNfaGVhZFRhaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSGVhZFRhaWw7XG59XG5cbmZ1bmN0aW9uIGlzX2NhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ2FwdHVyZTtcbn1cblxuZnVuY3Rpb24gaXNfdHlwZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBUeXBlO1xufVxuXG5mdW5jdGlvbiBpc19zdGFydHNXaXRoKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFN0YXJ0c1dpdGg7XG59XG5cbmZ1bmN0aW9uIGlzX2JvdW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJvdW5kO1xufVxuXG5mdW5jdGlvbiBpc19iaXRzdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nTWF0Y2g7XG59XG5cbmZ1bmN0aW9uIGlzX251bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2Z1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbmV4cG9ydCB7XG4gIGlzX251bWJlcixcbiAgaXNfc3RyaW5nLFxuICBpc19ib29sZWFuLFxuICBpc19zeW1ib2wsXG4gIGlzX251bGwsXG4gIGlzX3VuZGVmaW5lZCxcbiAgaXNfZnVuY3Rpb24sXG4gIGlzX3ZhcmlhYmxlLFxuICBpc193aWxkY2FyZCxcbiAgaXNfaGVhZFRhaWwsXG4gIGlzX2NhcHR1cmUsXG4gIGlzX3R5cGUsXG4gIGlzX3N0YXJ0c1dpdGgsXG4gIGlzX2JvdW5kLFxuICBpc19vYmplY3QsXG4gIGlzX2FycmF5LFxuICBpc19iaXRzdHJpbmcsXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVWYXJpYWJsZSgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKCkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoIDwgMikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGhlYWQgPSB2YWx1ZVswXTtcbiAgICBjb25zdCB0YWlsID0gdmFsdWUuc2xpY2UoMSk7XG5cbiAgICBhcmdzLnB1c2goaGVhZCk7XG4gICAgYXJncy5wdXNoKHRhaWwpO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVDYXB0dXJlKHBhdHRlcm4pIHtcbiAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi52YWx1ZSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKG1hdGNoZXModmFsdWUsIGFyZ3MpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKSB7XG4gIGNvbnN0IHByZWZpeCA9IHBhdHRlcm4ucHJlZml4O1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZS5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHBhdHRlcm4udHlwZSkge1xuICAgICAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi5vYmpQYXR0ZXJuKTtcbiAgICAgIHJldHVybiBtYXRjaGVzKHZhbHVlLCBhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVBcnJheShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBwYXR0ZXJuLm1hcCh4ID0+IGJ1aWxkTWF0Y2goeCkpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWUuZXZlcnkoZnVuY3Rpb24odiwgaSkge1xuICAgICAgcmV0dXJuIG1hdGNoZXNbaV0odmFsdWVbaV0sIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlT2JqZWN0KHBhdHRlcm4pIHtcbiAgbGV0IG1hdGNoZXMgPSB7fTtcblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocGF0dGVybikuY29uY2F0KFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocGF0dGVybilcbiAgKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCEoa2V5IGluIHZhbHVlKSB8fCAhbWF0Y2hlc1trZXldKHZhbHVlW2tleV0sIGFyZ3MpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJpdFN0cmluZyhwYXR0ZXJuKSB7XG4gIGxldCBwYXR0ZXJuQml0U3RyaW5nID0gW107XG5cbiAgZm9yIChsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0IG9mIHBhdHRlcm4udmFsdWVzKSB7XG4gICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICBsZXQgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcbiAgICAgIGZpbGxBcnJheShwYXR0ZXJuQml0U3RyaW5nLCBzaXplKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0dGVybkJpdFN0cmluZyA9IHBhdHRlcm5CaXRTdHJpbmcuY29uY2F0KFxuICAgICAgICBuZXcgQml0U3RyaW5nKGJpdHN0cmluZ01hdGNoUGFydCkudmFsdWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmIChpID09PSBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmdcbn07XG4iLCJpbXBvcnQgKiBhcyBSZXNvbHZlcnMgZnJvbSAnLi9yZXNvbHZlcnMnO1xuaW1wb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBIZWFkVGFpbCxcbiAgQ2FwdHVyZSxcbiAgVHlwZSxcbiAgU3RhcnRzV2l0aCxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxufSBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgcGF0dGVybk1hcCA9IG5ldyBNYXAoKTtcbnBhdHRlcm5NYXAuc2V0KFZhcmlhYmxlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZSk7XG5wYXR0ZXJuTWFwLnNldChXaWxkY2FyZC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQpO1xucGF0dGVybk1hcC5zZXQoSGVhZFRhaWwucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUhlYWRUYWlsKTtcbnBhdHRlcm5NYXAuc2V0KFN0YXJ0c1dpdGgucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN0YXJ0c1dpdGgpO1xucGF0dGVybk1hcC5zZXQoQ2FwdHVyZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQ2FwdHVyZSk7XG5wYXR0ZXJuTWFwLnNldChCb3VuZC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQm91bmQpO1xucGF0dGVybk1hcC5zZXQoVHlwZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlVHlwZSk7XG5wYXR0ZXJuTWFwLnNldChCaXRTdHJpbmdNYXRjaC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQml0U3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KE51bWJlci5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlTnVtYmVyKTtcbnBhdHRlcm5NYXAuc2V0KFN5bWJvbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKTtcbnBhdHRlcm5NYXAuc2V0KEFycmF5LnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVBcnJheSk7XG5wYXR0ZXJuTWFwLnNldChTdHJpbmcucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyk7XG5wYXR0ZXJuTWFwLnNldChCb29sZWFuLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKTtcbnBhdHRlcm5NYXAuc2V0KEZ1bmN0aW9uLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVGdW5jdGlvbik7XG5wYXR0ZXJuTWFwLnNldChPYmplY3QucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZU9iamVjdCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZE1hdGNoKHBhdHRlcm4pIHtcbiAgaWYgKHBhdHRlcm4gPT09IG51bGwpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOdWxsKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVdpbGRjYXJkKHBhdHRlcm4pO1xuICB9XG5cbiAgY29uc3QgdHlwZSA9IHBhdHRlcm4uY29uc3RydWN0b3IucHJvdG90eXBlO1xuICBjb25zdCByZXNvbHZlciA9IHBhdHRlcm5NYXAuZ2V0KHR5cGUpO1xuXG4gIGlmIChyZXNvbHZlcikge1xuICAgIHJldHVybiByZXNvbHZlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgRlVOQyA9IFN5bWJvbCgpO1xuXG5leHBvcnQgY2xhc3MgTWF0Y2hFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoYXJnKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnc3ltYm9sJykge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICBsZXQgbWFwcGVkVmFsdWVzID0gYXJnLm1hcCh4ID0+IHtcbiAgICAgICAgaWYgKHggPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB4ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB4LnRvU3RyaW5nKCk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIG1hcHBlZFZhbHVlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZztcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrID0gbmV3IEVycm9yKCkuc3RhY2s7XG4gICAgdGhpcy5uYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGF1c2Uge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmFyaXR5ID0gcGF0dGVybi5sZW5ndGg7XG4gICAgdGhpcy5vcHRpb25hbHMgPSBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICByZXR1cm4gbmV3IENsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbXBvbGluZShmbikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJlcyA9IGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgd2hpbGUgKHJlcyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXMgPSByZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoZ2VuKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBmdW5jdGlvbiooLi4uYXJncykge1xuICAgIGxldCBbZnVuY1RvQ2FsbCwgcGFyYW1zXSA9IGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpO1xuICAgIHJldHVybiB5aWVsZCogZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hHZW4oLi4uYXJncykge1xuICByZXR1cm4gZGVmbWF0Y2hnZW4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEFzeW5jKC4uLmNsYXVzZXMpIHtcbiAgY29uc3QgYXJpdGllcyA9IGdldEFyaXR5TWFwKGNsYXVzZXMpO1xuXG4gIHJldHVybiBhc3luYyBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgICAgYXJncyxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgICApO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpICYmXG4gICAgICAgICAgKGF3YWl0IHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKVxuICAgICAgICApIHtcbiAgICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICAgIHBhcmFtcyA9IHJlc3VsdDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignQXJpdHkgb2YnLCBhcmdzLmxlbmd0aCwgJ25vdCBmb3VuZC4gTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKSB7XG4gIGlmIChhcml0aWVzLmhhcyhhcmdzLmxlbmd0aCkpIHtcbiAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICBhcmdzLFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHNcbiAgICAgICk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJlxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KVxuICAgICAgKSB7XG4gICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgIHBhcmFtcyA9IHJlc3VsdDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gW2Z1bmNUb0NhbGwsIHBhcmFtc107XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignQXJpdHkgb2YnLCBhcmdzLmxlbmd0aCwgJ25vdCBmb3VuZC4gTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5TWFwKGNsYXVzZXMpIHtcbiAgbGV0IG1hcCA9IG5ldyBNYXAoKTtcblxuICBmb3IgKGNvbnN0IGNsYXVzZSBvZiBjbGF1c2VzKSB7XG4gICAgY29uc3QgcmFuZ2UgPSBnZXRBcml0eVJhbmdlKGNsYXVzZSk7XG5cbiAgICBmb3IgKGNvbnN0IGFyaXR5IG9mIHJhbmdlKSB7XG4gICAgICBsZXQgYXJpdHlDbGF1c2VzID0gW107XG5cbiAgICAgIGlmIChtYXAuaGFzKGFyaXR5KSkge1xuICAgICAgICBhcml0eUNsYXVzZXMgPSBtYXAuZ2V0KGFyaXR5KTtcbiAgICAgIH1cblxuICAgICAgYXJpdHlDbGF1c2VzLnB1c2goY2xhdXNlKTtcbiAgICAgIG1hcC5zZXQoYXJpdHksIGFyaXR5Q2xhdXNlcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1hcDtcbn1cblxuZnVuY3Rpb24gZ2V0QXJpdHlSYW5nZShjbGF1c2UpIHtcbiAgY29uc3QgbWluID0gY2xhdXNlLmFyaXR5IC0gY2xhdXNlLm9wdGlvbmFscy5sZW5ndGg7XG4gIGNvbnN0IG1heCA9IGNsYXVzZS5hcml0eTtcblxuICBsZXQgcmFuZ2UgPSBbbWluXTtcblxuICB3aGlsZSAocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gIT0gbWF4KSB7XG4gICAgcmFuZ2UucHVzaChyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSArIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJhbmdlO1xufVxuXG5mdW5jdGlvbiBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKSB7XG4gIGxldCBvcHRpb25hbHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm4ubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoXG4gICAgICBwYXR0ZXJuW2ldIGluc3RhbmNlb2YgVHlwZXMuVmFyaWFibGUgJiZcbiAgICAgIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZSAhPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpXG4gICAgKSB7XG4gICAgICBvcHRpb25hbHMucHVzaChbaSwgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlXSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9wdGlvbmFscztcbn1cblxuZnVuY3Rpb24gZmlsbEluT3B0aW9uYWxWYWx1ZXMoYXJncywgYXJpdHksIG9wdGlvbmFscykge1xuICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5IHx8IG9wdGlvbmFscy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGlmIChhcmdzLmxlbmd0aCArIG9wdGlvbmFscy5sZW5ndGggPCBhcml0eSkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgbGV0IG51bWJlck9mT3B0aW9uYWxzVG9GaWxsID0gYXJpdHkgLSBhcmdzLmxlbmd0aDtcbiAgbGV0IG9wdGlvbmFsc1RvUmVtb3ZlID0gb3B0aW9uYWxzLmxlbmd0aCAtIG51bWJlck9mT3B0aW9uYWxzVG9GaWxsO1xuXG4gIGxldCBvcHRpb25hbHNUb1VzZSA9IG9wdGlvbmFscy5zbGljZShvcHRpb25hbHNUb1JlbW92ZSk7XG5cbiAgZm9yIChsZXQgW2luZGV4LCB2YWx1ZV0gb2Ygb3B0aW9uYWxzVG9Vc2UpIHtcbiAgICBhcmdzLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhcmdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2gocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBpZiAocHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpICYmIGd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBleHByKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihleHByKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hfb3JfZGVmYXVsdChcbiAgcGF0dGVybixcbiAgZXhwcixcbiAgZ3VhcmQgPSAoKSA9PiB0cnVlLFxuICBkZWZhdWx0X3ZhbHVlID0gbnVsbFxuKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBpZiAocHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpICYmIGd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG4iLCJpbXBvcnQgeyBtYXRjaF9vcl9kZWZhdWx0IH0gZnJvbSBcIi4vZGVmbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5cbmNvbnN0IE5PX01BVENIID0gU3ltYm9sKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaXRzdHJpbmdfZ2VuZXJhdG9yKHBhdHRlcm4sIGJpdHN0cmluZykge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJldHVyblJlc3VsdCA9IFtdO1xuICAgIGxldCBic1NsaWNlID0gYml0c3RyaW5nLnNsaWNlKDAsIHBhdHRlcm4uYnl0ZV9zaXplKCkpO1xuICAgIGxldCBpID0gMTtcblxuICAgIHdoaWxlIChic1NsaWNlLmJ5dGVfc2l6ZSA9PSBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGJzU2xpY2UsICgpID0+IHRydWUsIE5PX01BVENIKTtcblxuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaChyZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBic1NsaWNlID0gYml0c3RyaW5nLnNsaWNlKFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogaSxcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIChpICsgMSlcbiAgICAgICk7XG5cbiAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuUmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdF9nZW5lcmF0b3IocGF0dGVybiwgbGlzdCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJldHVyblJlc3VsdCA9IFtdO1xuICAgIGZvciAobGV0IGkgb2YgbGlzdCkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBpLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuUmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdF9jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9yLCBnZW5lcmF0b3JzKSB7XG4gIGlmIChnZW5lcmF0b3JzLmxlbmd0aCA9PSAwKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvci5tYXAoeCA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh4KSkge1xuICAgICAgICByZXR1cm4geDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbeF07XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbGlzdCA9IGdlbmVyYXRvcnMucG9wKCk7XG5cbiAgICBsZXQgbmV4dF9nZW4gPSBbXTtcbiAgICBmb3IgKGxldCBqIG9mIGxpc3QoKSkge1xuICAgICAgZm9yIChsZXQgaSBvZiBnZW5lcmF0b3IpIHtcbiAgICAgICAgbmV4dF9nZW4ucHVzaChbal0uY29uY2F0KGkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcnVuX2dlbmVyYXRvcnMobmV4dF9nZW4sIGdlbmVyYXRvcnMpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJlc3VsdCA9IHJlc3VsdC5tYXAoeCA9PiBFcmxhbmdUeXBlcy5CaXRTdHJpbmcuaW50ZWdlcih4KSk7XG4gIHJldHVybiBuZXcgRXJsYW5nVHlwZXMuQml0U3RyaW5nKC4uLnJlc3VsdCk7XG59XG4iLCJpbXBvcnQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBkZWZtYXRjaGdlbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmMsXG59IGZyb20gJy4vdGFpbG9yZWQvZGVmbWF0Y2gnO1xuaW1wb3J0IHtcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIGJpdFN0cmluZ01hdGNoLFxufSBmcm9tICcuL3RhaWxvcmVkL3R5cGVzJztcblxuaW1wb3J0IHtcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG59IGZyb20gJy4vdGFpbG9yZWQvY29tcHJlaGVuc2lvbnMnO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luYyxcbn07XG4iXSwibmFtZXMiOlsiVmFyaWFibGUiLCJkZWZhdWx0X3ZhbHVlIiwiU3ltYm9sIiwiZm9yIiwiV2lsZGNhcmQiLCJTdGFydHNXaXRoIiwicHJlZml4IiwiQ2FwdHVyZSIsInZhbHVlIiwiSGVhZFRhaWwiLCJUeXBlIiwidHlwZSIsIm9ialBhdHRlcm4iLCJCb3VuZCIsIkJpdFN0cmluZ01hdGNoIiwidmFsdWVzIiwibGVuZ3RoIiwiYnl0ZV9zaXplIiwicyIsInZhbCIsInVuaXQiLCJzaXplIiwiaW5kZXgiLCJnZXRWYWx1ZSIsInZhcmlhYmxlIiwid2lsZGNhcmQiLCJzdGFydHNXaXRoIiwiY2FwdHVyZSIsImhlYWRUYWlsIiwiYm91bmQiLCJiaXRTdHJpbmdNYXRjaCIsImlzX251bWJlciIsImlzX3N0cmluZyIsImlzX2Jvb2xlYW4iLCJpc19zeW1ib2wiLCJpc19vYmplY3QiLCJpc192YXJpYWJsZSIsImlzX251bGwiLCJpc19hcnJheSIsIkFycmF5IiwiaXNBcnJheSIsImlzX2Z1bmN0aW9uIiwiT2JqZWN0IiwicHJvdG90eXBlIiwidG9TdHJpbmciLCJjYWxsIiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlRnVuY3Rpb24iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJyZXNvbHZlV2lsZGNhcmQiLCJyZXNvbHZlVmFyaWFibGUiLCJwdXNoIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlT2JqZWN0Iiwia2V5cyIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsImtleSIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiZnJvbSIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZUJpdFN0cmluZyIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5IiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImFycmF5c0VxdWFsIiwiYSIsImIiLCJmaWxsQXJyYXkiLCJhcnIiLCJudW0iLCJpbnRlZ2VyUGFydHMiLCJlbGVtIiwiaW50ZWdlciIsInJlc29sdmVOb01hdGNoIiwicGF0dGVybk1hcCIsIk1hcCIsInNldCIsIlJlc29sdmVycyIsIk51bWJlciIsIkJvb2xlYW4iLCJGdW5jdGlvbiIsImNvbnN0cnVjdG9yIiwicmVzb2x2ZXIiLCJnZXQiLCJNYXRjaEVycm9yIiwiYXJnIiwibWVzc2FnZSIsIm1hcHBlZFZhbHVlcyIsInN0YWNrIiwibmFtZSIsIkNsYXVzZSIsImZuIiwiZ3VhcmQiLCJhcml0eSIsIm9wdGlvbmFscyIsImdldE9wdGlvbmFsVmFsdWVzIiwiY2xhdXNlIiwiZGVmbWF0Y2giLCJjbGF1c2VzIiwiYXJpdGllcyIsImdldEFyaXR5TWFwIiwiZnVuY1RvQ2FsbCIsInBhcmFtcyIsImZpbmRNYXRjaGluZ0Z1bmN0aW9uIiwiZGVmbWF0Y2hnZW4iLCJkZWZtYXRjaEdlbiIsImRlZm1hdGNoQXN5bmMiLCJoYXMiLCJhcml0eUNsYXVzZXMiLCJwcm9jZXNzZWRDbGF1c2UiLCJyZXN1bHQiLCJmaWxsSW5PcHRpb25hbFZhbHVlcyIsImVycm9yIiwicmFuZ2UiLCJnZXRBcml0eVJhbmdlIiwibWluIiwibWF4IiwiVHlwZXMiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwibWF0Y2hfb3JfZGVmYXVsdCIsIk5PX01BVENIIiwiYml0c3RyaW5nX2dlbmVyYXRvciIsImJpdHN0cmluZyIsInJldHVyblJlc3VsdCIsImJzU2xpY2UiLCJsaXN0X2dlbmVyYXRvciIsImxpc3QiLCJsaXN0X2NvbXByZWhlbnNpb24iLCJleHByZXNzaW9uIiwiZ2VuZXJhdG9ycyIsImdlbmVyYXRlZFZhbHVlcyIsInJ1bl9nZW5lcmF0b3JzIiwicG9wIiwiZ2VuZXJhdG9yIiwibmV4dF9nZW4iLCJqIiwiYml0c3RyaW5nX2NvbXByZWhlbnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOztBQUVBLE1BQU1BLFFBQU4sQ0FBZTs7Y0FFREMsZ0JBQWdCQyxPQUFPQyxHQUFQLENBQVcsbUJBQVgsQ0FBNUIsRUFBNkQ7U0FDdERGLGFBQUwsR0FBcUJBLGFBQXJCOzs7O0FBSUosTUFBTUcsUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIsTUFBTUMsVUFBTixDQUFpQjs7Y0FFSEMsTUFBWixFQUFvQjtTQUNiQSxNQUFMLEdBQWNBLE1BQWQ7Ozs7QUFJSixNQUFNQyxPQUFOLENBQWM7O2NBRUFDLEtBQVosRUFBbUI7U0FDWkEs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
