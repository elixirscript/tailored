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

function is_null(value) {
  return value === null;
}

function is_undefined(value) {
  return typeof value === 'undefined';
}

function is_variable(value) {
  return value instanceof Variable;
}

function is_wildcard(value) {
  return value instanceof Wildcard;
}

function is_headTail(value) {
  return value instanceof HeadTail;
}

function is_capture(value) {
  return value instanceof Capture;
}

function is_type(value) {
  return value instanceof Type;
}

function is_startsWith(value) {
  return value instanceof StartsWith;
}

function is_bound(value) {
  return value instanceof Bound;
}

function is_object(value) {
  return typeof value === 'object';
}

function is_array(value) {
  return Array.isArray(value);
}

function is_bitstring(value) {
  return value instanceof BitStringMatch;
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

  for (let key of Object.keys(pattern).concat(Object.getOwnPropertySymbols(pattern))) {
    matches[key] = buildMatch(pattern[key]);
  }

  return function (value, args) {
    if (!is_object(value) || pattern.length > value.length) {
      return false;
    }

    for (let key of Object.keys(pattern).concat(Object.getOwnPropertySymbols(pattern))) {
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
        throw new Error("a binary field without size is only allowed at the end of a binary pattern");
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
            if (bitstringMatchPart.attributes && bitstringMatchPart.attributes.indexOf("signed") != -1) {
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

/* @flow */
function buildMatch(pattern) {

  if (is_variable(pattern)) {
    return resolveVariable(pattern);
  }

  if (is_wildcard(pattern)) {
    return resolveWildcard(pattern);
  }

  if (is_undefined(pattern)) {
    return resolveWildcard(pattern);
  }

  if (is_headTail(pattern)) {
    return resolveHeadTail(pattern);
  }

  if (is_startsWith(pattern)) {
    return resolveStartsWith(pattern);
  }

  if (is_capture(pattern)) {
    return resolveCapture(pattern);
  }

  if (is_bound(pattern)) {
    return resolveBound(pattern);
  }

  if (is_type(pattern)) {
    return resolveType(pattern);
  }

  if (is_array(pattern)) {
    return resolveArray(pattern);
  }

  if (is_number(pattern)) {
    return resolveNumber(pattern);
  }

  if (is_string(pattern)) {
    return resolveString(pattern);
  }

  if (is_boolean(pattern)) {
    return resolveBoolean(pattern);
  }

  if (is_symbol(pattern)) {
    return resolveSymbol(pattern);
  }

  if (is_null(pattern)) {
    return resolveNull(pattern);
  }

  if (is_bitstring(pattern)) {
    return resolveBitString(pattern);
  }

  if (is_object(pattern)) {
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
      let mappedValues = arg.map(x => x.toString());
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
    let [funcToCall, params] = findMatchingFunction(args, arities);
    return funcToCall.apply(this, params);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBWYXJpYWJsZSwgV2lsZGNhcmQsIEhlYWRUYWlsLCBDYXB0dXJlLCBUeXBlLCBTdGFydHNXaXRoLCBCb3VuZCwgQml0U3RyaW5nTWF0Y2ggfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSl7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZ1xufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tIFwiLi9jaGVja3NcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zeW1ib2wodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RyaW5nKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfYm9vbGVhbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3Mpe1xuICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCl7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKCl7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncyl7XG4gICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKCkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKG1hdGNoZXModmFsdWUsIGFyZ3MpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKXtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGZvcihsZXQga2V5IG9mIE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pKSl7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKSkpe1xuICAgICAgaWYoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IobGV0IGJpdHN0cmluZ01hdGNoUGFydCBvZiBwYXR0ZXJuLnZhbHVlcyl7XG4gICAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpe1xuICAgICAgbGV0IHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG4gICAgICBmaWxsQXJyYXkocGF0dGVybkJpdFN0cmluZywgc2l6ZSk7XG4gICAgfWVsc2V7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQobmV3IEJpdFN0cmluZyhiaXRzdHJpbmdNYXRjaFBhcnQpLnZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmKCFDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiAhKHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nKSApe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKXtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspe1xuICAgICAgbGV0IGJpdHN0cmluZ01hdGNoUGFydCA9IHBhdHRlcm5WYWx1ZXNbaV07XG5cbiAgICAgIGlmKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImEgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuXCIpO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgsIGJlZ2lubmluZ0luZGV4ICsgc2l6ZSk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4LCBiZWdpbm5pbmdJbmRleCArIHNpemUpO1xuICAgICAgfVxuXG4gICAgICBpZihDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSl7XG4gICAgICAgIHN3aXRjaChiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICBpZihiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcyAmJiBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcy5pbmRleE9mKFwic2lnbmVkXCIpICE9IC0xKXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgSW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICBpZihzaXplID09PSA2NCl7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH0gZWxzZSBpZihzaXplID09PSAzMil7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgIGFyZ3MucHVzaChjcmVhdGVCaXRTdHJpbmcoYnNWYWx1ZUFycmF5UGFydCkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1lbHNlIGlmKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG59XG5cbmZ1bmN0aW9uIGdldFNpemUodW5pdCwgc2l6ZSl7XG4gIHJldHVybiAodW5pdCAqIHNpemUpIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKXtcbiAgZm9yKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKXtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKXtcbiAgbGV0IGludGVnZXJQYXJ0cyA9IGFyci5tYXAoKGVsZW0pID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmdcbn07XG4iLCIvKiBAZmxvdyAqL1xuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gXCIuL3Jlc29sdmVyc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG5cbiAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc193aWxkY2FyZChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfdW5kZWZpbmVkKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19oZWFkVGFpbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfc3RhcnRzV2l0aChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19jYXB0dXJlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2JvdW5kKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb3VuZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc190eXBlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVUeXBlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2FycmF5KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVBcnJheShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19udW1iZXIocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19zdHJpbmcocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyhwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19ib29sZWFuKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX3N5bWJvbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX251bGwocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfYml0c3RyaW5nKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfb2JqZWN0KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgRlVOQyA9IFN5bWJvbCgpO1xuXG5leHBvcnQgY2xhc3MgTWF0Y2hFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoYXJnKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnc3ltYm9sJykge1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICBsZXQgbWFwcGVkVmFsdWVzID0gYXJnLm1hcCh4ID0+IHgudG9TdHJpbmcoKSk7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKSB7XG4gIGlmIChhcml0aWVzLmhhcyhhcmdzLmxlbmd0aCkpIHtcbiAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICBhcmdzLFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHMsXG4gICAgICApO1xuXG4gICAgICBpZiAoXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCkgJiZcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdClcbiAgICAgICkge1xuICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtmdW5jVG9DYWxsLCBwYXJhbXNdO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0FyaXR5IG9mJywgYXJncy5sZW5ndGgsICdub3QgZm91bmQuIE5vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcml0eU1hcChjbGF1c2VzKSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgZm9yIChjb25zdCBjbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgIGNvbnN0IHJhbmdlID0gZ2V0QXJpdHlSYW5nZShjbGF1c2UpO1xuXG4gICAgZm9yIChjb25zdCBhcml0eSBvZiByYW5nZSkge1xuICAgICAgbGV0IGFyaXR5Q2xhdXNlcyA9IFtdO1xuXG4gICAgICBpZiAobWFwLmhhcyhhcml0eSkpIHtcbiAgICAgICAgYXJpdHlDbGF1c2VzID0gbWFwLmdldChhcml0eSk7XG4gICAgICB9XG5cbiAgICAgIGFyaXR5Q2xhdXNlcy5wdXNoKGNsYXVzZSk7XG4gICAgICBtYXAuc2V0KGFyaXR5LCBhcml0eUNsYXVzZXMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXA7XG59XG5cbmZ1bmN0aW9uIGdldEFyaXR5UmFuZ2UoY2xhdXNlKSB7XG4gIGNvbnN0IG1pbiA9IGNsYXVzZS5hcml0eSAtIGNsYXVzZS5vcHRpb25hbHMubGVuZ3RoO1xuICBjb25zdCBtYXggPSBjbGF1c2UuYXJpdHk7XG5cbiAgbGV0IHJhbmdlID0gW21pbl07XG5cbiAgd2hpbGUgKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICE9IG1heCkge1xuICAgIHJhbmdlLnB1c2gocmFuZ2VbcmFuZ2UubGVuZ3RoIC0gMV0gKyAxKTtcbiAgfVxuXG4gIHJldHVybiByYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuICAgICkge1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpIHtcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSB8fCBvcHRpb25hbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZiAoYXJncy5sZW5ndGggKyBvcHRpb25hbHMubGVuZ3RoIDwgYXJpdHkpIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGxldCBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCA9IGFyaXR5IC0gYXJncy5sZW5ndGg7XG4gIGxldCBvcHRpb25hbHNUb1JlbW92ZSA9IG9wdGlvbmFscy5sZW5ndGggLSBudW1iZXJPZk9wdGlvbmFsc1RvRmlsbDtcblxuICBsZXQgb3B0aW9uYWxzVG9Vc2UgPSBvcHRpb25hbHMuc2xpY2Uob3B0aW9uYWxzVG9SZW1vdmUpO1xuXG4gIGZvciAobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKSB7XG4gICAgYXJncy5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5KSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgZXhwcik7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoZXhwcik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGwsXG4pIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGlmIChwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCkgJiYgZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcblxuY29uc3QgTk9fTUFUQ0ggPSBTeW1ib2woKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19nZW5lcmF0b3IocGF0dGVybiwgYml0c3RyaW5nKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgbGV0IGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoMCwgcGF0dGVybi5ieXRlX3NpemUoKSk7XG4gICAgbGV0IGkgPSAxO1xuXG4gICAgd2hpbGUgKGJzU2xpY2UuYnl0ZV9zaXplID09IHBhdHRlcm4uYnl0ZV9zaXplKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgYnNTbGljZSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiBpLFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogKGkgKyAxKVxuICAgICAgKTtcblxuICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2dlbmVyYXRvcihwYXR0ZXJuLCBsaXN0KSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgZm9yIChsZXQgaSBvZiBsaXN0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGksICgpID0+IHRydWUsIE5PX01BVENIKTtcbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3IsIGdlbmVyYXRvcnMpIHtcbiAgaWYgKGdlbmVyYXRvcnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yLm1hcCh4ID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgICAgIHJldHVybiB4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFt4XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsaXN0ID0gZ2VuZXJhdG9ycy5wb3AoKTtcblxuICAgIGxldCBuZXh0X2dlbiA9IFtdO1xuICAgIGZvciAobGV0IGogb2YgbGlzdCgpKSB7XG4gICAgICBmb3IgKGxldCBpIG9mIGdlbmVyYXRvcikge1xuICAgICAgICBuZXh0X2dlbi5wdXNoKFtqXS5jb25jYXQoaSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBydW5fZ2VuZXJhdG9ycyhuZXh0X2dlbiwgZ2VuZXJhdG9ycyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmVzdWx0ID0gcmVzdWx0Lm1hcCh4ID0+IEVybGFuZ1R5cGVzLkJpdFN0cmluZy5pbnRlZ2VyKHgpKTtcbiAgcmV0dXJuIG5ldyBFcmxhbmdUeXBlcy5CaXRTdHJpbmcoLi4ucmVzdWx0KTtcbn1cbiIsImltcG9ydCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIGRlZm1hdGNoZ2VuLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luYyxcbn0gZnJvbSAnLi90YWlsb3JlZC9kZWZtYXRjaCc7XG5pbXBvcnQge1xuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2gsXG59IGZyb20gJy4vdGFpbG9yZWQvdHlwZXMnO1xuXG5pbXBvcnQge1xuICBsaXN0X2dlbmVyYXRvcixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbixcbn0gZnJvbSAnLi90YWlsb3JlZC9jb21wcmVoZW5zaW9ucyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIGJpdFN0cmluZ01hdGNoLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBkZWZtYXRjaGdlbixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBsaXN0X2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jLFxufTtcbiJdLCJuYW1lcyI6WyJWYXJpYWJsZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsIlR5cGUiLCJ0eXBlIiwib2JqUGF0dGVybiIsIkJvdW5kIiwiQml0U3RyaW5nTWF0Y2giLCJ2YWx1ZXMiLCJsZW5ndGgiLCJieXRlX3NpemUiLCJzIiwidmFsIiwidW5pdCIsInNpemUiLCJpbmRleCIsImdldFZhbHVlIiwidmFyaWFibGUiLCJ3aWxkY2FyZCIsInN0YXJ0c1dpdGgiLCJjYXB0dXJlIiwiaGVhZFRhaWwiLCJib3VuZCIsImJpdFN0cmluZ01hdGNoIiwiaXNfbnVtYmVyIiwiaXNfc3RyaW5nIiwiaXNfYm9vbGVhbiIsImlzX3N5bWJvbCIsImlzX251bGwiLCJpc191bmRlZmluZWQiLCJpc192YXJpYWJsZSIsImlzX3dpbGRjYXJkIiwiaXNfaGVhZFRhaWwiLCJpc19jYXB0dXJlIiwiaXNfdHlwZSIsImlzX3N0YXJ0c1dpdGgiLCJpc19ib3VuZCIsImlzX29iamVjdCIsImlzX2FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiaXNfYml0c3RyaW5nIiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJwdXNoIiwicmVzb2x2ZVdpbGRjYXJkIiwicmVzb2x2ZVZhcmlhYmxlIiwicmVzb2x2ZUhlYWRUYWlsIiwiaGVhZCIsInRhaWwiLCJzbGljZSIsInJlc29sdmVDYXB0dXJlIiwibWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJyZXNvbHZlU3RhcnRzV2l0aCIsInN1YnN0cmluZyIsInJlc29sdmVUeXBlIiwicmVzb2x2ZUFycmF5IiwibWFwIiwieCIsImV2ZXJ5IiwidiIsImkiLCJyZXNvbHZlT2JqZWN0Iiwia2V5IiwiT2JqZWN0Iiwia2V5cyIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiZnJvbSIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZUJpdFN0cmluZyIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5IiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImFycmF5c0VxdWFsIiwiYSIsImIiLCJmaWxsQXJyYXkiLCJhcnIiLCJudW0iLCJpbnRlZ2VyUGFydHMiLCJlbGVtIiwiaW50ZWdlciIsInJlc29sdmVOb01hdGNoIiwiUmVzb2x2ZXJzIiwiTWF0Y2hFcnJvciIsImFyZyIsIm1lc3NhZ2UiLCJ0b1N0cmluZyIsIm1hcHBlZFZhbHVlcyIsInN0YWNrIiwibmFtZSIsImNvbnN0cnVjdG9yIiwiQ2xhdXNlIiwiZm4iLCJndWFyZCIsImFyaXR5Iiwib3B0aW9uYWxzIiwiZ2V0T3B0aW9uYWxWYWx1ZXMiLCJjbGF1c2UiLCJkZWZtYXRjaCIsImNsYXVzZXMiLCJhcml0aWVzIiwiZ2V0QXJpdHlNYXAiLCJmdW5jVG9DYWxsIiwicGFyYW1zIiwiZmluZE1hdGNoaW5nRnVuY3Rpb24iLCJkZWZtYXRjaGdlbiIsImRlZm1hdGNoR2VuIiwiZGVmbWF0Y2hBc3luYyIsImhhcyIsImFyaXR5Q2xhdXNlcyIsImdldCIsInByb2Nlc3NlZENsYXVzZSIsInJlc3VsdCIsImZpbGxJbk9wdGlvbmFsVmFsdWVzIiwiZXJyb3IiLCJNYXAiLCJyYW5nZSIsImdldEFyaXR5UmFuZ2UiLCJzZXQiLCJtaW4iLCJtYXgiLCJUeXBlcyIsIm51bWJlck9mT3B0aW9uYWxzVG9GaWxsIiwib3B0aW9uYWxzVG9SZW1vdmUiLCJvcHRpb25hbHNUb1VzZSIsInNwbGljZSIsIm1hdGNoIiwiZXhwciIsInByb2Nlc3NlZFBhdHRlcm4iLCJtYXRjaF9vcl9kZWZhdWx0IiwiTk9fTUFUQ0giLCJiaXRzdHJpbmdfZ2VuZXJhdG9yIiwiYml0c3RyaW5nIiwicmV0dXJuUmVzdWx0IiwiYnNTbGljZSIsImxpc3RfZ2VuZXJhdG9yIiwibGlzdCIsImxpc3RfY29tcHJlaGVuc2lvbiIsImV4cHJlc3Npb24iLCJnZW5lcmF0b3JzIiwiZ2VuZXJhdGVkVmFsdWVzIiwicnVuX2dlbmVyYXRvcnMiLCJwb3AiLCJnZW5lcmF0b3IiLCJuZXh0X2dlbiIsImoiLCJiaXRzdHJpbmdfY29tcHJlaGVuc2lvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7O0FBRUEsTUFBTUEsUUFBTixDQUFlOztjQUVEQyxnQkFBZ0JDLE9BQU9DLEdBQVAsQ0FBVyxtQkFBWCxDQUE1QixFQUE2RDtTQUN0REYsYUFBTCxHQUFxQkEsYUFBckI7Ozs7QUFJSixNQUFNRyxRQUFOLENBQWU7Z0JBQ0M7OztBQUloQixNQUFNQyxVQUFOLENBQWlCOztjQUVIQyxNQUFaLEVBQW9CO1NBQ2JBLE1BQUwsR0FBY0EsTUFBZDs7OztBQUlKLE1BQU1DLE9BQU4sQ0FBYzs7Y0FFQUMsS0FBWixFQUFtQjtTQUNaQSxLQUFMLEdBQWFBLEtBQWI7Ozs7QUFJSixNQUFNQyxRQUFOLENBQWU7Z0JBQ0M7OztBQUloQixNQUFNQyxJQUFOLENBQVc7O2NBRUdDLElBQVosRUFBa0JDLGFBQWEsRUFBL0IsRUFBbUM7U0FDNUJELElBQUwsR0FBWUEsSUFBWjtTQUNLQyxVQUFMLEdBQWtCQSxVQUFsQjs7OztBQUlKLE1BQU1DLEtBQU4sQ0FBWTs7Y0FFRUwsS0FBWixFQUFtQjtTQUNaQSxLQUFMLEdBQWFBLEtBQWI7Ozs7QUFJSixNQUFNTSxjQUFOLENBQXFCOztjQUVQLEdBQUdDLE1BQWYsRUFBc0I7U0FDZkEsTUFBTCxHQUFjQSxNQUFkOzs7V0FHTztXQUNBQSxPQUFPQyxNQUFkOzs7YUFHUztXQUNGLEtBQUtDLFNBQUwsS0FBbUIsQ0FBMUI7OztjQUdTO1FBQ0xDLElBQUksQ0FBUjs7U0FFSSxJQUFJQyxHQUFSLElBQWUsS0FBS0osTUFBcEIsRUFBMkI7VUFDckJHLElBQU1DLElBQUlDLElBQUosR0FBV0QsSUFBSUUsSUFBaEIsR0FBc0IsQ0FBL0I7OztXQUdLSCxD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
