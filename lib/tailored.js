'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ErlangTypes = require('erlang-types');
var ErlangTypes__default = _interopDefault(ErlangTypes);

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

const BitString$1 = ErlangTypes__default.BitString;

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
      patternBitString = patternBitString.concat(new BitString$1(bitstringMatchPart).value);
    }
  }

  let patternValues = pattern.values;

  return function (value, args) {
    let bsValue = null;

    if (!is_string(value) && !(value instanceof BitString$1)) {
      return false;
    }

    if (is_string(value)) {
      bsValue = new BitString$1(BitString$1.binary(value));
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
  let integerParts = arr.map(elem => BitString$1.integer(elem));
  return new BitString$1(...integerParts);
}

function resolveNoMatch() {
  return function () {
    return false;
  };
}

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

    if (typeof arg === "symbol") {
      this.message = "No match for: " + arg.toString();
    } else if (Array.isArray(arg)) {
      let mappedValues = arg.map(x => x.toString());
      this.message = "No match for: " + mappedValues;
    } else {
      this.message = "No match for: " + arg;
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

function trampoline(fn) {
  return function () {
    let res = fn.apply(this, arguments);
    while (res instanceof Function) {
      res = res();
    }
    return res;
  };
}

function defmatch(...clauses) {
  return function (...args) {
    let funcToCall = null;
    let params = null;
    for (let processedClause of clauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        funcToCall = processedClause.fn;
        params = result;
        break;
      }
    }

    if (!funcToCall) {
      console.error("No match for:", args);
      throw new MatchError(args);
    }

    return funcToCall.apply(this, params);
  };
}

function defmatchgen(...clauses) {
  return function* (...args) {
    for (let processedClause of clauses) {
      let result = [];
      args = fillInOptionalValues(args, processedClause.arity, processedClause.optionals);

      if (processedClause.pattern(args, result) && processedClause.guard.apply(this, result)) {
        return yield* processedClause.fn.apply(this, result);
      }
    }

    console.error("No match for:", args);
    throw new MatchError(args);
  };
}

function getOptionalValues(pattern) {
  let optionals = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] instanceof Variable && pattern[i].default_value != Symbol.for("tailored.no_value")) {
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
    console.error("No match for:", expr);
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
    for (let i of bitstring) {
      const result = match_or_default(pattern, i, () => true, NO_MATCH);
      if (result != NO_MATCH) {
        const [value] = result;
        returnResult.push(value);
      }
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
  const generatedValues = run_list_generators(generators.pop()(), generators);

  let result = [];

  for (let value of generatedValues) {
    if (expression.guard.apply(this, value)) {
      result.push(expression.fn.apply(this, value));
    }
  }

  return result;
}

function run_list_generators(generator, generators) {
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

    return run_list_generators(next_gen, generators);
  }
}

function bitstring_comprehension(expression, generators) {
  const generatedValues = run_bitstring_generators(generators.pop()(), generators);

  let result = [];

  for (let value of generatedValues) {
    if (expression.guard.apply(this, value)) {
      result.push(expression.fn.apply(this, value));
    }
  }

  result = result.map(x => ErlangTypes.BitString.integer(x));
  return new ErlangTypes.BitString(...result);
}

function run_bitstring_generators(generator, generators) {
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

    return run_bitstring_generators(next_gen, generators);
  }
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
  trampoline
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBWYXJpYWJsZSwgV2lsZGNhcmQsIEhlYWRUYWlsLCBDYXB0dXJlLCBUeXBlLCBTdGFydHNXaXRoLCBCb3VuZCwgQml0U3RyaW5nTWF0Y2ggfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSl7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZ1xufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tIFwiLi9jaGVja3NcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zeW1ib2wodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RyaW5nKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfYm9vbGVhbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3Mpe1xuICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCl7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKCl7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncyl7XG4gICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKCkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKG1hdGNoZXModmFsdWUsIGFyZ3MpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKXtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGZvcihsZXQga2V5IG9mIE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pKSl7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKSkpe1xuICAgICAgaWYoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IobGV0IGJpdHN0cmluZ01hdGNoUGFydCBvZiBwYXR0ZXJuLnZhbHVlcyl7XG4gICAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpe1xuICAgICAgbGV0IHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG4gICAgICBmaWxsQXJyYXkocGF0dGVybkJpdFN0cmluZywgc2l6ZSk7XG4gICAgfWVsc2V7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQobmV3IEJpdFN0cmluZyhiaXRzdHJpbmdNYXRjaFBhcnQpLnZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmKCFDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiAhKHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nKSApe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKXtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspe1xuICAgICAgbGV0IGJpdHN0cmluZ01hdGNoUGFydCA9IHBhdHRlcm5WYWx1ZXNbaV07XG5cbiAgICAgIGlmKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImEgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuXCIpO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgsIGJlZ2lubmluZ0luZGV4ICsgc2l6ZSk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4LCBiZWdpbm5pbmdJbmRleCArIHNpemUpO1xuICAgICAgfVxuXG4gICAgICBpZihDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSl7XG4gICAgICAgIHN3aXRjaChiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICBpZihiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcyAmJiBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcy5pbmRleE9mKFwic2lnbmVkXCIpICE9IC0xKXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgSW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICBpZihzaXplID09PSA2NCl7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH0gZWxzZSBpZihzaXplID09PSAzMil7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgIGFyZ3MucHVzaChjcmVhdGVCaXRTdHJpbmcoYnNWYWx1ZUFycmF5UGFydCkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1lbHNlIGlmKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG59XG5cbmZ1bmN0aW9uIGdldFNpemUodW5pdCwgc2l6ZSl7XG4gIHJldHVybiAodW5pdCAqIHNpemUpIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKXtcbiAgZm9yKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKXtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKXtcbiAgbGV0IGludGVnZXJQYXJ0cyA9IGFyci5tYXAoKGVsZW0pID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmdcbn07XG4iLCIvKiBAZmxvdyAqL1xuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gXCIuL3Jlc29sdmVyc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG5cbiAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc193aWxkY2FyZChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfdW5kZWZpbmVkKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19oZWFkVGFpbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfc3RhcnRzV2l0aChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19jYXB0dXJlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2JvdW5kKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb3VuZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc190eXBlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVUeXBlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2FycmF5KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVBcnJheShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19udW1iZXIocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19zdHJpbmcocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyhwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19ib29sZWFuKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX3N5bWJvbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX251bGwocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfYml0c3RyaW5nKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfb2JqZWN0KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5cbmNvbnN0IEZVTkMgPSBTeW1ib2woKTtcblxuZXhwb3J0IGNsYXNzIE1hdGNoRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGFyZykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gXCJzeW1ib2xcIikge1xuICAgICAgdGhpcy5tZXNzYWdlID0gXCJObyBtYXRjaCBmb3I6IFwiICsgYXJnLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKHggPT4geC50b1N0cmluZygpKTtcbiAgICAgIHRoaXMubWVzc2FnZSA9IFwiTm8gbWF0Y2ggZm9yOiBcIiArIG1hcHBlZFZhbHVlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5tZXNzYWdlID0gXCJObyBtYXRjaCBmb3I6IFwiICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgY2xhdXNlcykge1xuICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgYXJncyA9IGZpbGxJbk9wdGlvbmFsVmFsdWVzKFxuICAgICAgICBhcmdzLFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuYXJpdHksXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHNcbiAgICAgICk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJlxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KVxuICAgICAgKSB7XG4gICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgIHBhcmFtcyA9IHJlc3VsdDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFmdW5jVG9DYWxsKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiTm8gbWF0Y2ggZm9yOlwiLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaGdlbiguLi5jbGF1c2VzKSB7XG4gIHJldHVybiBmdW5jdGlvbiooLi4uYXJncykge1xuICAgIGZvciAobGV0IHByb2Nlc3NlZENsYXVzZSBvZiBjbGF1c2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgKTtcblxuICAgICAgaWYgKFxuICAgICAgICBwcm9jZXNzZWRDbGF1c2UucGF0dGVybihhcmdzLCByZXN1bHQpICYmXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHlpZWxkKiBwcm9jZXNzZWRDbGF1c2UuZm4uYXBwbHkodGhpcywgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLmVycm9yKFwiTm8gbWF0Y2ggZm9yOlwiLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybikge1xuICBsZXQgb3B0aW9uYWxzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKFxuICAgICAgcGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmXG4gICAgICBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWUgIT0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpXG4gICAgKSB7XG4gICAgICBvcHRpb25hbHMucHVzaChbaSwgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlXSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9wdGlvbmFscztcbn1cblxuZnVuY3Rpb24gZmlsbEluT3B0aW9uYWxWYWx1ZXMoYXJncywgYXJpdHksIG9wdGlvbmFscykge1xuICBpZiAoYXJncy5sZW5ndGggPT09IGFyaXR5IHx8IG9wdGlvbmFscy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIGlmIChhcmdzLmxlbmd0aCArIG9wdGlvbmFscy5sZW5ndGggPCBhcml0eSkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgbGV0IG51bWJlck9mT3B0aW9uYWxzVG9GaWxsID0gYXJpdHkgLSBhcmdzLmxlbmd0aDtcbiAgbGV0IG9wdGlvbmFsc1RvUmVtb3ZlID0gb3B0aW9uYWxzLmxlbmd0aCAtIG51bWJlck9mT3B0aW9uYWxzVG9GaWxsO1xuXG4gIGxldCBvcHRpb25hbHNUb1VzZSA9IG9wdGlvbmFscy5zbGljZShvcHRpb25hbHNUb1JlbW92ZSk7XG5cbiAgZm9yIChsZXQgW2luZGV4LCB2YWx1ZV0gb2Ygb3B0aW9uYWxzVG9Vc2UpIHtcbiAgICBhcmdzLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhcmdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2gocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIGxldCByZXN1bHQgPSBbXTtcbiAgbGV0IHByb2Nlc3NlZFBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICBpZiAocHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpICYmIGd1YXJkLmFwcGx5KHRoaXMsIHJlc3VsdCkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJObyBtYXRjaCBmb3I6XCIsIGV4cHIpO1xuICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGV4cHIpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaF9vcl9kZWZhdWx0KFxuICBwYXR0ZXJuLFxuICBleHByLFxuICBndWFyZCA9ICgpID0+IHRydWUsXG4gIGRlZmF1bHRfdmFsdWUgPSBudWxsXG4pIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGlmIChwcm9jZXNzZWRQYXR0ZXJuKGV4cHIsIHJlc3VsdCkgJiYgZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IHsgQml0U3RyaW5nIH0gZnJvbSBcImVybGFuZy10eXBlc1wiO1xuXG5jb25zdCBOT19NQVRDSCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gYml0c3RyaW5nX2dlbmVyYXRvcihwYXR0ZXJuLCBiaXRzdHJpbmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxldCByZXR1cm5SZXN1bHQgPSBbXTtcbiAgICBmb3IgKGxldCBpIG9mIGJpdHN0cmluZykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBpLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuUmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdF9nZW5lcmF0b3IocGF0dGVybiwgbGlzdCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbGV0IHJldHVyblJlc3VsdCA9IFtdO1xuICAgIGZvciAobGV0IGkgb2YgbGlzdCkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hfb3JfZGVmYXVsdChwYXR0ZXJuLCBpLCAoKSA9PiB0cnVlLCBOT19NQVRDSCk7XG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0dXJuUmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdF9jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2xpc3RfZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fbGlzdF9nZW5lcmF0b3JzKGdlbmVyYXRvciwgZ2VuZXJhdG9ycykge1xuICBpZiAoZ2VuZXJhdG9ycy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBnZW5lcmF0b3IubWFwKHggPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoeCkpIHtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW3hdO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxpc3QgPSBnZW5lcmF0b3JzLnBvcCgpO1xuXG4gICAgbGV0IG5leHRfZ2VuID0gW107XG4gICAgZm9yIChsZXQgaiBvZiBsaXN0KCkpIHtcbiAgICAgIGZvciAobGV0IGkgb2YgZ2VuZXJhdG9yKSB7XG4gICAgICAgIG5leHRfZ2VuLnB1c2goW2pdLmNvbmNhdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJ1bl9saXN0X2dlbmVyYXRvcnMobmV4dF9nZW4sIGdlbmVyYXRvcnMpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaXRzdHJpbmdfY29tcHJlaGVuc2lvbihleHByZXNzaW9uLCBnZW5lcmF0b3JzKSB7XG4gIGNvbnN0IGdlbmVyYXRlZFZhbHVlcyA9IHJ1bl9iaXRzdHJpbmdfZ2VuZXJhdG9ycyhcbiAgICBnZW5lcmF0b3JzLnBvcCgpKCksXG4gICAgZ2VuZXJhdG9yc1xuICApO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXN1bHQgPSByZXN1bHQubWFwKHggPT4gQml0U3RyaW5nLmludGVnZXIoeCkpO1xuICByZXR1cm4gbmV3IEJpdFN0cmluZyguLi5yZXN1bHQpO1xufVxuXG5mdW5jdGlvbiBydW5fYml0c3RyaW5nX2dlbmVyYXRvcnMoZ2VuZXJhdG9yLCBnZW5lcmF0b3JzKSB7XG4gIGlmIChnZW5lcmF0b3JzLmxlbmd0aCA9PSAwKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvci5tYXAoeCA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh4KSkge1xuICAgICAgICByZXR1cm4geDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbeF07XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbGlzdCA9IGdlbmVyYXRvcnMucG9wKCk7XG5cbiAgICBsZXQgbmV4dF9nZW4gPSBbXTtcbiAgICBmb3IgKGxldCBqIG9mIGxpc3QoKSkge1xuICAgICAgZm9yIChsZXQgaSBvZiBnZW5lcmF0b3IpIHtcbiAgICAgICAgbmV4dF9nZW4ucHVzaChbal0uY29uY2F0KGkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcnVuX2JpdHN0cmluZ19nZW5lcmF0b3JzKG5leHRfZ2VuLCBnZW5lcmF0b3JzKTtcbiAgfVxufVxuIiwiaW1wb3J0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICBDbGF1c2UsXG4gIGNsYXVzZSxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIHRyYW1wb2xpbmVcbn0gZnJvbSBcIi4vdGFpbG9yZWQvZGVmbWF0Y2hcIjtcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaFxufSBmcm9tIFwiLi90YWlsb3JlZC90eXBlc1wiO1xuXG5pbXBvcnQge1xuICBsaXN0X2dlbmVyYXRvcixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBiaXRzdHJpbmdfZ2VuZXJhdG9yLFxuICBiaXRzdHJpbmdfY29tcHJlaGVuc2lvblxufSBmcm9tIFwiLi90YWlsb3JlZC9jb21wcmVoZW5zaW9uc1wiO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgdmFyaWFibGUsXG4gIHdpbGRjYXJkLFxuICBzdGFydHNXaXRoLFxuICBjYXB0dXJlLFxuICBoZWFkVGFpbCxcbiAgdHlwZSxcbiAgYm91bmQsXG4gIENsYXVzZSxcbiAgY2xhdXNlLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgbWF0Y2hfb3JfZGVmYXVsdCxcbiAgZGVmbWF0Y2hnZW4sXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19nZW5lcmF0b3IsXG4gIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uLFxuICB0cmFtcG9saW5lXG59O1xuIl0sIm5hbWVzIjpbIkJpdFN0cmluZyIsIkVybGFuZ1R5cGVzIiwiQ2hlY2tzLmlzX3N5bWJvbCIsIkNoZWNrcy5pc19zdHJpbmciLCJDaGVja3MuaXNfbnVtYmVyIiwiQ2hlY2tzLmlzX2Jvb2xlYW4iLCJDaGVja3MuaXNfbnVsbCIsIkNoZWNrcy5pc19hcnJheSIsIkNoZWNrcy5pc19vYmplY3QiLCJDaGVja3MuaXNfdmFyaWFibGUiLCJSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlIiwiQ2hlY2tzLmlzX3dpbGRjYXJkIiwiUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCIsIkNoZWNrcy5pc191bmRlZmluZWQiLCJDaGVja3MuaXNfaGVhZFRhaWwiLCJSZXNvbHZlcnMucmVzb2x2ZUhlYWRUYWlsIiwiQ2hlY2tzLmlzX3N0YXJ0c1dpdGgiLCJSZXNvbHZlcnMucmVzb2x2ZVN0YXJ0c1dpdGgiLCJDaGVja3MuaXNfY2FwdHVyZSIsIlJlc29sdmVycy5yZXNvbHZlQ2FwdHVyZSIsIkNoZWNrcy5pc19ib3VuZCIsIlJlc29sdmVycy5yZXNvbHZlQm91bmQiLCJDaGVja3MuaXNfdHlwZSIsIlJlc29sdmVycy5yZXNvbHZlVHlwZSIsIlJlc29sdmVycy5yZXNvbHZlQXJyYXkiLCJSZXNvbHZlcnMucmVzb2x2ZU51bWJlciIsIlJlc29sdmVycy5yZXNvbHZlU3RyaW5nIiwiUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuIiwiUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wiLCJSZXNvbHZlcnMucmVzb2x2ZU51bGwiLCJDaGVja3MuaXNfYml0c3RyaW5nIiwiUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmciLCJSZXNvbHZlcnMucmVzb2x2ZU9iamVjdCIsIlJlc29sdmVycy5yZXNvbHZlTm9NYXRjaCIsIlR5cGVzLlZhcmlhYmxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFFQSxNQUFNLFFBQU4sQ0FBZTs7Y0FFRCxnQkFBZ0IsT0FBTyxHQUFQLENBQVcsbUJBQVgsQ0FBNUIsRUFBNkQ7U0FDdEQsYUFBTCxHQUFxQixhQUFyQjs7OztBQUlKLE1BQU0sUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIsTUFBTSxVQUFOLENBQWlCOztjQUVILE1BQVosRUFBb0I7U0FDYixNQUFMLEdBQWMsTUFBZDs7OztBQUlKLE1BQU0sT0FBTixDQUFjOztjQUVBLEtBQVosRUFBbUI7U0FDWixLQUFMLEdBQWEsS0FBYjs7OztBQUlKLE1BQU0sUUFBTixDQUFlO2dCQUNDOzs7QUFJaEIs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