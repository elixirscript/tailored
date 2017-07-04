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
      args.push(value);
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
      return matches(value, args) && args.push(value) > 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIEhlYWRUYWlsLFxuICBDYXB0dXJlLFxuICBUeXBlLFxuICBTdGFydHNXaXRoLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdHlwZXMnO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbn1cblxuZnVuY3Rpb24gaXNfYm9vbGVhbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbic7XG59XG5cbmZ1bmN0aW9uIGlzX3N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3ltYm9sJztcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19vYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG5cbmZ1bmN0aW9uIGlzX3ZhcmlhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFZhcmlhYmxlO1xufVxuXG5mdW5jdGlvbiBpc193aWxkY2FyZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXaWxkY2FyZDtcbn1cblxuZnVuY3Rpb24gaXNfaGVhZFRhaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgSGVhZFRhaWw7XG59XG5cbmZ1bmN0aW9uIGlzX2NhcHR1cmUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ2FwdHVyZTtcbn1cblxuZnVuY3Rpb24gaXNfdHlwZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBUeXBlO1xufVxuXG5mdW5jdGlvbiBpc19zdGFydHNXaXRoKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFN0YXJ0c1dpdGg7XG59XG5cbmZ1bmN0aW9uIGlzX2JvdW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJvdW5kO1xufVxuXG5mdW5jdGlvbiBpc19iaXRzdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nTWF0Y2g7XG59XG5cbmZ1bmN0aW9uIGlzX251bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2Z1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbmV4cG9ydCB7XG4gIGlzX251bWJlcixcbiAgaXNfc3RyaW5nLFxuICBpc19ib29sZWFuLFxuICBpc19zeW1ib2wsXG4gIGlzX251bGwsXG4gIGlzX3VuZGVmaW5lZCxcbiAgaXNfZnVuY3Rpb24sXG4gIGlzX3ZhcmlhYmxlLFxuICBpc193aWxkY2FyZCxcbiAgaXNfaGVhZFRhaWwsXG4gIGlzX2NhcHR1cmUsXG4gIGlzX3R5cGUsXG4gIGlzX3N0YXJ0c1dpdGgsXG4gIGlzX2JvdW5kLFxuICBpc19vYmplY3QsXG4gIGlzX2FycmF5LFxuICBpc19iaXRzdHJpbmcsXG59O1xuIiwiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gJy4vY2hlY2tzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gJ2VybGFuZy10eXBlcyc7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdW1iZXIocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19mdW5jdGlvbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOdWxsKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpIHtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVXaWxkY2FyZCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVmFyaWFibGUoKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVIZWFkVGFpbCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCA8IDIpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChtYXRjaGVzKHZhbHVlLCBhcmdzKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybikge1xuICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnByZWZpeDtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVR5cGUocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpIHtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoICE9IHBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU9iamVjdChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0ge307XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pLFxuICApO1xuXG4gIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKCFDaGVja3MuaXNfb2JqZWN0KHZhbHVlKSB8fCBwYXR0ZXJuLmxlbmd0aCA+IHZhbHVlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAobGV0IGtleSBvZiBrZXlzKSB7XG4gICAgICBpZiAoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IgKGxldCBiaXRzdHJpbmdNYXRjaFBhcnQgb2YgcGF0dGVybi52YWx1ZXMpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpIHtcbiAgICAgIGxldCBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuICAgICAgZmlsbEFycmF5KHBhdHRlcm5CaXRTdHJpbmcsIHNpemUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQoXG4gICAgICAgIG5ldyBCaXRTdHJpbmcoYml0c3RyaW5nTWF0Y2hQYXJ0KS52YWx1ZSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHNpemUgPSAwO1xuICAgICAgbGV0IGJzVmFsdWVBcnJheVBhcnQgPSBbXTtcbiAgICAgIGxldCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gW107XG4gICAgICBzaXplID0gZ2V0U2l6ZShiaXRzdHJpbmdNYXRjaFBhcnQudW5pdCwgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUpO1xuXG4gICAgICBpZiAoaSA9PT0gcGF0dGVyblZhbHVlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplLFxuICAgICAgICApO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemUsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmOCc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMTYnOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgbmV3IFVpbnQxNkFycmF5KGJzVmFsdWVBcnJheVBhcnQpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAndXRmMzInOlxuICAgICAgICAgICAgYXJncy5wdXNoKFxuICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmcsXG59O1xuIiwiaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gJy4vcmVzb2x2ZXJzJztcbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaCxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbmNvbnN0IHBhdHRlcm5NYXAgPSBuZXcgTWFwKCk7XG5wYXR0ZXJuTWFwLnNldChWYXJpYWJsZS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlVmFyaWFibGUpO1xucGF0dGVybk1hcC5zZXQoV2lsZGNhcmQucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVdpbGRjYXJkKTtcbnBhdHRlcm5NYXAuc2V0KEhlYWRUYWlsLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVIZWFkVGFpbCk7XG5wYXR0ZXJuTWFwLnNldChTdGFydHNXaXRoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTdGFydHNXaXRoKTtcbnBhdHRlcm5NYXAuc2V0KENhcHR1cmUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUNhcHR1cmUpO1xucGF0dGVybk1hcC5zZXQoQm91bmQucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvdW5kKTtcbnBhdHRlcm5NYXAuc2V0KFR5cGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVR5cGUpO1xucGF0dGVybk1hcC5zZXQoQml0U3RyaW5nTWF0Y2gucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJpdFN0cmluZyk7XG5wYXR0ZXJuTWFwLnNldChOdW1iZXIucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcik7XG5wYXR0ZXJuTWFwLnNldChTeW1ib2wucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVN5bWJvbCk7XG5wYXR0ZXJuTWFwLnNldChBcnJheS5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQXJyYXkpO1xucGF0dGVybk1hcC5zZXQoU3RyaW5nLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoQm9vbGVhbi5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlQm9vbGVhbik7XG5wYXR0ZXJuTWFwLnNldChGdW5jdGlvbi5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlRnVuY3Rpb24pO1xucGF0dGVybk1hcC5zZXQoT2JqZWN0LnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QpO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG4gIGlmIChwYXR0ZXJuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTnVsbChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBwYXR0ZXJuLmNvbnN0cnVjdG9yLnByb3RvdHlwZTtcbiAgY29uc3QgcmVzb2x2ZXIgPSBwYXR0ZXJuTWFwLmdldCh0eXBlKTtcblxuICBpZiAocmVzb2x2ZXIpIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KHBhdHRlcm4pO1xuICB9XG5cbiAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlTm9NYXRjaCgpO1xufVxuIiwiaW1wb3J0IHsgYnVpbGRNYXRjaCB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi90eXBlcyc7XG5cbmNvbnN0IEZVTkMgPSBTeW1ib2woKTtcblxuZXhwb3J0IGNsYXNzIE1hdGNoRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGFyZykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmcudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgbGV0IG1hcHBlZFZhbHVlcyA9IGFyZy5tYXAoeCA9PiB7XG4gICAgICAgIGlmICh4ID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuICdudWxsJztcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgeCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geC50b1N0cmluZygpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBtYXBwZWRWYWx1ZXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmc7XG4gICAgfVxuXG4gICAgdGhpcy5zdGFjayA9IG5ldyBFcnJvcigpLnN0YWNrO1xuICAgIHRoaXMubmFtZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2xhdXNlIHtcbiAgY29uc3RydWN0b3IocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICAgIHRoaXMucGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gICAgdGhpcy5hcml0eSA9IHBhdHRlcm4ubGVuZ3RoO1xuICAgIHRoaXMub3B0aW9uYWxzID0gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybik7XG4gICAgdGhpcy5mbiA9IGZuO1xuICAgIHRoaXMuZ3VhcmQgPSBndWFyZDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgcmV0dXJuIG5ldyBDbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW1wb2xpbmUoZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXMgPSBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHdoaWxlIChyZXMgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgcmVzID0gcmVzKCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaCguLi5jbGF1c2VzKSB7XG4gIGNvbnN0IGFyaXRpZXMgPSBnZXRBcml0eU1hcChjbGF1c2VzKTtcblxuICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgIGxldCBbZnVuY1RvQ2FsbCwgcGFyYW1zXSA9IGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpO1xuICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaGdlbiguLi5jbGF1c2VzKSB7XG4gIGNvbnN0IGFyaXRpZXMgPSBnZXRBcml0eU1hcChjbGF1c2VzKTtcblxuICByZXR1cm4gZnVuY3Rpb24qKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4geWllbGQqIGZ1bmNUb0NhbGwuYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoR2VuKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIGRlZm1hdGNoZ2VuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hBc3luYyguLi5jbGF1c2VzKSB7XG4gIGNvbnN0IGFyaXRpZXMgPSBnZXRBcml0eU1hcChjbGF1c2VzKTtcblxuICByZXR1cm4gYXN5bmMgZnVuY3Rpb24oLi4uYXJncykge1xuICAgIGlmIChhcml0aWVzLmhhcyhhcmdzLmxlbmd0aCkpIHtcbiAgICAgIGNvbnN0IGFyaXR5Q2xhdXNlcyA9IGFyaXRpZXMuZ2V0KGFyZ3MubGVuZ3RoKTtcblxuICAgICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgYXJpdHlDbGF1c2VzKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHNcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgZnVuY1RvQ2FsbCA9IHByb2Nlc3NlZENsYXVzZS5mbjtcbiAgICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcykge1xuICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgY29uc3QgYXJpdHlDbGF1c2VzID0gYXJpdGllcy5nZXQoYXJncy5sZW5ndGgpO1xuXG4gICAgbGV0IGZ1bmNUb0NhbGwgPSBudWxsO1xuICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBhcml0eUNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgYXJncyxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmFyaXR5LFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICApO1xuXG4gICAgICBpZiAoXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCkgJiZcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdClcbiAgICAgICkge1xuICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtmdW5jVG9DYWxsLCBwYXJhbXNdO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcml0eU1hcChjbGF1c2VzKSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgZm9yIChjb25zdCBjbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgIGNvbnN0IHJhbmdlID0gZ2V0QXJpdHlSYW5nZShjbGF1c2UpO1xuXG4gICAgZm9yIChjb25zdCBhcml0eSBvZiByYW5nZSkge1xuICAgICAgbGV0IGFyaXR5Q2xhdXNlcyA9IFtdO1xuXG4gICAgICBpZiAobWFwLmhhcyhhcml0eSkpIHtcbiAgICAgICAgYXJpdHlDbGF1c2VzID0gbWFwLmdldChhcml0eSk7XG4gICAgICB9XG5cbiAgICAgIGFyaXR5Q2xhdXNlcy5wdXNoKGNsYXVzZSk7XG4gICAgICBtYXAuc2V0KGFyaXR5LCBhcml0eUNsYXVzZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5UmFuZ2UoY2xhdXNlKSB7XG4gIGNvbnN0IG1pbiA9IGNsYXVzZS5hcml0eSAtIGNsYXVzZS5vcHRpb25hbHMubGVuZ3RoO1xuICBjb25zdCBtYXggPSBjbGF1c2UuYXJpdHk7XG5cbiAgbGV0IHJhbmdlID0gW21pbl07XG5cbiAgd2hpbGUgKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICE9IG1heCkge1xuICAgIHJhbmdlLnB1c2gocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gKyAxKTtcbiAgfVxuXG4gIHJldHVybiByYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuICAgICkge1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSB8fCBvcHRpb25hbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZiAoYXJncy5sZW5ndGggKyBvcHRpb25hbHMubGVuZ3RoIDwgYXJpdHkpIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGxldCBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCA9IGFyaXR5IC0gYXJncy5sZW5ndGg7XG4gIGxldCBvcHRpb25hbHNUb1JlbW92ZSA9IG9wdGlvbmFscy5sZW5ndGggLSBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbDtcblxuICBsZXQgb3B0aW9uYWxzVG9Vc2UgPSBvcHRpb25hbHMuc2xpY2Uob3B0aW9uYWxzVG9SZW1vdmUpO1xuXG4gIGZvciAobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKSB7XG4gICAgYXJncy5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgZXhwcik7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoZXhwcik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGxcbikge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgbWF0Y2hfb3JfZGVmYXVsdCB9IGZyb20gXCIuL2RlZm1hdGNoXCI7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSBcImVybGFuZy10eXBlc1wiO1xuXG5jb25zdCBOT19NQVRDSCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2dlbmVyYXRvcihwYXR0ZXJuLCBiaXRzdHJpbmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBsZXQgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZSgwLCBwYXR0ZXJuLmJ5dGVfc2l6ZSgpKTtcbiAgICBsZXQgaSA9IDE7XG5cbiAgICB3aGlsZSAoYnNTbGljZS5ieXRlX3NpemUgPT0gcGF0dGVybi5ieXRlX3NpemUoKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBic1NsaWNlLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2gocmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgYnNTbGljZSA9IGJpdHN0cmluZy5zbGljZShcbiAgICAgICAgcGF0dGVybi5ieXRlX3NpemUoKSAqIGksXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiAoaSArIDEpXG4gICAgICApO1xuXG4gICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfZ2VuZXJhdG9yKHBhdHRlcm4sIGxpc3QpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpIG9mIGxpc3QpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgaSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuICAgICAgaWYgKHJlc3VsdCAhPSBOT19NQVRDSCkge1xuICAgICAgICBjb25zdCBbdmFsdWVdID0gcmVzdWx0O1xuICAgICAgICByZXR1cm5SZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldHVyblJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvcnMucG9wKCkoKSwgZ2VuZXJhdG9ycyk7XG5cbiAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gIGZvciAobGV0IHZhbHVlIG9mIGdlbmVyYXRlZFZhbHVlcykge1xuICAgIGlmIChleHByZXNzaW9uLmd1YXJkLmFwcGx5KHRoaXMsIHZhbHVlKSkge1xuICAgICAgcmVzdWx0LnB1c2goZXhwcmVzc2lvbi5mbi5hcHBseSh0aGlzLCB2YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJ1bl9nZW5lcmF0b3JzKGdlbmVyYXRvciwgZ2VuZXJhdG9ycykge1xuICBpZiAoZ2VuZXJhdG9ycy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBnZW5lcmF0b3IubWFwKHggPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoeCkpIHtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW3hdO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxpc3QgPSBnZW5lcmF0b3JzLnBvcCgpO1xuXG4gICAgbGV0IG5leHRfZ2VuID0gW107XG4gICAgZm9yIChsZXQgaiBvZiBsaXN0KCkpIHtcbiAgICAgIGZvciAobGV0IGkgb2YgZ2VuZXJhdG9yKSB7XG4gICAgICAgIG5leHRfZ2VuLnB1c2goW2pdLmNvbmNhdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJ1bl9nZW5lcmF0b3JzKG5leHRfZ2VuLCBnZW5lcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXN1bHQgPSByZXN1bHQubWFwKHggPT4gRXJsYW5nVHlwZXMuQml0U3RyaW5nLmludGVnZXIoeCkpO1xuICByZXR1cm4gbmV3IEVybGFuZ1R5cGVzLkJpdFN0cmluZyguLi5yZXN1bHQpO1xufVxuIiwiaW1wb3J0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufSBmcm9tICcuL3RhaWxvcmVkL2RlZm1hdGNoJztcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbn0gZnJvbSAnLi90YWlsb3JlZC90eXBlcyc7XG5cbmltcG9ydCB7XG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxufSBmcm9tICcuL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zJztcblxuZXhwb3J0IGRlZmF1bHQge1xuICBkZWZtYXRjaCxcbiAgbWF0Y2gsXG4gIE1hdGNoRXJyb3IsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgYml0U3RyaW5nTWF0Y2gsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBsaXN0X2NvbXByZWhlbnNpb24sXG4gIGxpc3RfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbiAgZGVmbWF0Y2hHZW4sXG4gIGRlZm1hdGNoQXN5bmMsXG59O1xuIl0sIm5hbWVzIjpbIlZhcmlhYmxlIiwiZGVmYXVsdF92YWx1ZSIsIlN5bWJvbCIsImZvciIsIldpbGRjYXJkIiwiU3RhcnRzV2l0aCIsInByZWZpeCIsIkNhcHR1cmUiLCJ2YWx1ZSIsIkhlYWRUYWlsIiwiVHlwZSIsInR5cGUiLCJvYmpQYXR0ZXJuIiwiQm91bmQiLCJCaXRTdHJpbmdNYXRjaCIsInZhbHVlcyIsImxlbmd0aCIsImJ5dGVfc2l6ZSIsInMiLCJ2YWwiLCJ1bml0Iiwic2l6ZSIsImluZGV4IiwiZ2V0VmFsdWUiLCJ2YXJpYWJsZSIsIndpbGRjYXJkIiwic3RhcnRzV2l0aCIsImNhcHR1cmUiLCJoZWFkVGFpbCIsImJvdW5kIiwiYml0U3RyaW5nTWF0Y2giLCJpc19udW1iZXIiLCJpc19zdHJpbmciLCJpc19ib29sZWFuIiwiaXNfc3ltYm9sIiwiaXNfb2JqZWN0IiwiaXNfdmFyaWFibGUiLCJpc19udWxsIiwiaXNfYXJyYXkiLCJBcnJheSIsImlzQXJyYXkiLCJpc19mdW5jdGlvbiIsIk9iamVjdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCIsIkJpdFN0cmluZyIsIkVybGFuZ1R5cGVzIiwicmVzb2x2ZVN5bWJvbCIsInBhdHRlcm4iLCJDaGVja3MiLCJyZXNvbHZlU3RyaW5nIiwicmVzb2x2ZU51bWJlciIsInJlc29sdmVCb29sZWFuIiwicmVzb2x2ZUZ1bmN0aW9uIiwicmVzb2x2ZU51bGwiLCJyZXNvbHZlQm91bmQiLCJhcmdzIiwicHVzaCIsInJlc29sdmVXaWxkY2FyZCIsInJlc29sdmVWYXJpYWJsZSIsInJlc29sdmVIZWFkVGFpbCIsImhlYWQiLCJ0YWlsIiwic2xpY2UiLCJyZXNvbHZlQ2FwdHVyZSIsIm1hdGNoZXMiLCJidWlsZE1hdGNoIiwicmVzb2x2ZVN0YXJ0c1dpdGgiLCJzdWJzdHJpbmciLCJyZXNvbHZlVHlwZSIsInJlc29sdmVBcnJheSIsIm1hcCIsIngiLCJldmVyeSIsInYiLCJpIiwicmVzb2x2ZU9iamVjdCIsImtleXMiLCJjb25jYXQiLCJnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJrZXkiLCJyZXNvbHZlQml0U3RyaW5nIiwicGF0dGVybkJpdFN0cmluZyIsImJpdHN0cmluZ01hdGNoUGFydCIsImdldFNpemUiLCJwYXR0ZXJuVmFsdWVzIiwiYnNWYWx1ZSIsImJpbmFyeSIsImJlZ2lubmluZ0luZGV4IiwidW5kZWZpbmVkIiwiRXJyb3IiLCJic1ZhbHVlQXJyYXlQYXJ0IiwicGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCIsImF0dHJpYnV0ZXMiLCJpbmRleE9mIiwiSW50OEFycmF5IiwiVWludDhBcnJheSIsIkZsb2F0NjRBcnJheSIsImZyb20iLCJGbG9hdDMyQXJyYXkiLCJjcmVhdGVCaXRTdHJpbmciLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJhcHBseSIsIlVpbnQxNkFycmF5IiwiVWludDMyQXJyYXkiLCJhcnJheXNFcXVhbCIsImEiLCJiIiwiZmlsbEFycmF5IiwiYXJyIiwibnVtIiwiaW50ZWdlclBhcnRzIiwiZWxlbSIsImludGVnZXIiLCJyZXNvbHZlTm9NYXRjaCIsInBhdHRlcm5NYXAiLCJNYXAiLCJzZXQiLCJSZXNvbHZlcnMiLCJOdW1iZXIiLCJCb29sZWFuIiwiRnVuY3Rpb24iLCJjb25zdHJ1Y3RvciIsInJlc29sdmVyIiwiZ2V0IiwiTWF0Y2hFcnJvciIsImFyZyIsIm1lc3NhZ2UiLCJtYXBwZWRWYWx1ZXMiLCJzdGFjayIsIm5hbWUiLCJDbGF1c2UiLCJmbiIsImd1YXJkIiwiYXJpdHkiLCJvcHRpb25hbHMiLCJnZXRPcHRpb25hbFZhbHVlcyIsImNsYXVzZSIsImRlZm1hdGNoIiwiY2xhdXNlcyIsImFyaXRpZXMiLCJnZXRBcml0eU1hcCIsImZ1bmNUb0NhbGwiLCJwYXJhbXMiLCJmaW5kTWF0Y2hpbmdGdW5jdGlvbiIsImRlZm1hdGNoZ2VuIiwiZGVmbWF0Y2hHZW4iLCJkZWZtYXRjaEFzeW5jIiwiaGFzIiwiYXJpdHlDbGF1c2VzIiwicHJvY2Vzc2VkQ2xhdXNlIiwicmVzdWx0IiwiZmlsbEluT3B0aW9uYWxWYWx1ZXMiLCJlcnJvciIsInJhbmdlIiwiZ2V0QXJpdHlSYW5nZSIsIm1pbiIsIm1heCIsIlR5cGVzIiwibnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwiLCJvcHRpb25hbHNUb1JlbW92ZSIsIm9wdGlvbmFsc1RvVXNlIiwic3BsaWNlIiwibWF0Y2giLCJleHByIiwicHJvY2Vzc2VkUGF0dGVybiIsIm1hdGNoX29yX2RlZmF1bHQiLCJOT19NQVRDSCIsImJpdHN0cmluZ19nZW5lcmF0b3IiLCJiaXRzdHJpbmciLCJyZXR1cm5SZXN1bHQiLCJic1NsaWNlIiwibGlzdF9nZW5lcmF0b3IiLCJsaXN0IiwibGlzdF9jb21wcmVoZW5zaW9uIiwiZXhwcmVzc2lvbiIsImdlbmVyYXRvcnMiLCJnZW5lcmF0ZWRWYWx1ZXMiLCJydW5fZ2VuZXJhdG9ycyIsInBvcCIsImdlbmVyYXRvciIsIm5leHRfZ2VuIiwiaiIsImJpdHN0cmluZ19jb21wcmVoZW5zaW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7QUFFQSxNQUFNQSxRQUFOLENBQWU7O2NBRURDLGdCQUFnQkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBQTVCLEVBQTZEO1NBQ3RE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
