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

function trampoline(fn) {
  return function () {
    var res = fn.apply(this, arguments);
    while (res instanceof Function) {
      res = res();
    }
    return res;
  };
}

function defmatch(...clauses) {
  return trampoline(function (...args) {
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
      console.error('No match for:', args);
      throw new MatchError(args);
    }

    return funcToCall.bind(this, ...params);
  });
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

    console.error('No match for:', args);
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

var index = {
  defmatch, match, MatchError,
  variable, wildcard, startsWith,
  capture, headTail, type, bound,
  Clause, clause, bitStringMatch,
  match_or_default, defmatchgen
};

module.exports = index;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcblxuICBjb25zdHJ1Y3RvcihkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gICAgdGhpcy5kZWZhdWx0X3ZhbHVlID0gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuXG4gIGNvbnN0cnVjdG9yKHByZWZpeCkge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG5cbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcblxuICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5jbGFzcyBCaXRTdHJpbmdNYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoLi4udmFsdWVzKXtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpe1xuICAgIGxldCBzID0gMDtcblxuICAgIGZvcihsZXQgdmFsIG9mIHRoaXMudmFsdWVzKXtcbiAgICAgIHMgPSBzICsgKCh2YWwudW5pdCAqIHZhbC5zaXplKS84KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGdldFZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMoaW5kZXgpO1xuICB9XG5cbiAgZ2V0U2l6ZU9mVmFsdWUoaW5kZXgpe1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KXtcbiAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpbmRleCkudHlwZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcihcInRhaWxvcmVkLm5vX3ZhbHVlXCIpKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUoZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKCkge1xuICByZXR1cm4gbmV3IEhlYWRUYWlsKCk7XG59XG5cbmZ1bmN0aW9uIHR5cGUodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGJpdFN0cmluZ01hdGNoKC4uLnZhbHVlcyl7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZXhwb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBTdGFydHNXaXRoLFxuICBDYXB0dXJlLFxuICBIZWFkVGFpbCxcbiAgVHlwZSxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgYml0U3RyaW5nTWF0Y2hcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBWYXJpYWJsZSwgV2lsZGNhcmQsIEhlYWRUYWlsLCBDYXB0dXJlLCBUeXBlLCBTdGFydHNXaXRoLCBCb3VuZCwgQml0U3RyaW5nTWF0Y2ggfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5mdW5jdGlvbiBpc19udW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzX3N0cmluZyh2YWx1ZSl7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc19ib29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn1cblxuZnVuY3Rpb24gaXNfc3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfdW5kZWZpbmVkKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc19hcnJheSh2YWx1ZSkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGlzX2JpdHN0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmdNYXRjaDtcbn1cblxuZXhwb3J0IHtcbiAgaXNfbnVtYmVyLFxuICBpc19zdHJpbmcsXG4gIGlzX2Jvb2xlYW4sXG4gIGlzX3N5bWJvbCxcbiAgaXNfbnVsbCxcbiAgaXNfdW5kZWZpbmVkLFxuICBpc19mdW5jdGlvbixcbiAgaXNfdmFyaWFibGUsXG4gIGlzX3dpbGRjYXJkLFxuICBpc19oZWFkVGFpbCxcbiAgaXNfY2FwdHVyZSxcbiAgaXNfdHlwZSxcbiAgaXNfc3RhcnRzV2l0aCxcbiAgaXNfYm91bmQsXG4gIGlzX29iamVjdCxcbiAgaXNfYXJyYXksXG4gIGlzX2JpdHN0cmluZ1xufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCAqIGFzIENoZWNrcyBmcm9tIFwiLi9jaGVja3NcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCBFcmxhbmdUeXBlcyBmcm9tIFwiZXJsYW5nLXR5cGVzXCI7XG5jb25zdCBCaXRTdHJpbmcgPSBFcmxhbmdUeXBlcy5CaXRTdHJpbmc7XG5cbmZ1bmN0aW9uIHJlc29sdmVTeW1ib2wocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19zeW1ib2wodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlU3RyaW5nKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bWJlcih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb29sZWFuKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiBDaGVja3MuaXNfYm9vbGVhbih2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVGdW5jdGlvbihwYXR0ZXJuKXtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybil7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udWxsKHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvdW5kKHBhdHRlcm4pe1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3Mpe1xuICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mIHBhdHRlcm4udmFsdWUgJiYgdmFsdWUgPT09IHBhdHRlcm4udmFsdWUpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVdpbGRjYXJkKCl7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKCl7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncyl7XG4gICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUhlYWRUYWlsKCkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggPCAyKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkID0gdmFsdWVbMF07XG4gICAgY29uc3QgdGFpbCA9IHZhbHVlLnNsaWNlKDEpO1xuXG4gICAgYXJncy5wdXNoKGhlYWQpO1xuICAgIGFyZ3MucHVzaCh0YWlsKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKG1hdGNoZXModmFsdWUsIGFyZ3MpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdGFydHNXaXRoKHBhdHRlcm4pIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlVHlwZShwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybi50eXBlKXtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncykgJiYgYXJncy5wdXNoKHZhbHVlKSA+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZighQ2hlY2tzLmlzX2FycmF5KHZhbHVlKSB8fCB2YWx1ZS5sZW5ndGggIT0gcGF0dGVybi5sZW5ndGgpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZS5ldmVyeShmdW5jdGlvbih2LCBpKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlc1tpXSh2YWx1ZVtpXSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPYmplY3QocGF0dGVybikge1xuICBsZXQgbWF0Y2hlcyA9IHt9O1xuXG4gIGZvcihsZXQga2V5IG9mIE9iamVjdC5rZXlzKHBhdHRlcm4pLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHBhdHRlcm4pKSl7XG4gICAgbWF0Y2hlc1trZXldID0gYnVpbGRNYXRjaChwYXR0ZXJuW2tleV0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKS5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhwYXR0ZXJuKSkpe1xuICAgICAgaWYoIShrZXkgaW4gdmFsdWUpIHx8ICFtYXRjaGVzW2tleV0odmFsdWVba2V5XSwgYXJncykgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQml0U3RyaW5nKHBhdHRlcm4pIHtcbiAgbGV0IHBhdHRlcm5CaXRTdHJpbmcgPSBbXTtcblxuICBmb3IobGV0IGJpdHN0cmluZ01hdGNoUGFydCBvZiBwYXR0ZXJuLnZhbHVlcyl7XG4gICAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKGJpdHN0cmluZ01hdGNoUGFydC52YWx1ZSkpe1xuICAgICAgbGV0IHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG4gICAgICBmaWxsQXJyYXkocGF0dGVybkJpdFN0cmluZywgc2l6ZSk7XG4gICAgfWVsc2V7XG4gICAgICBwYXR0ZXJuQml0U3RyaW5nID0gcGF0dGVybkJpdFN0cmluZy5jb25jYXQobmV3IEJpdFN0cmluZyhiaXRzdHJpbmdNYXRjaFBhcnQpLnZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBsZXQgcGF0dGVyblZhbHVlcyA9IHBhdHRlcm4udmFsdWVzO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGxldCBic1ZhbHVlID0gbnVsbDtcblxuICAgIGlmKCFDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiAhKHZhbHVlIGluc3RhbmNlb2YgQml0U3RyaW5nKSApe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKXtcbiAgICAgIGJzVmFsdWUgPSBuZXcgQml0U3RyaW5nKEJpdFN0cmluZy5iaW5hcnkodmFsdWUpKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoOyBpKyspe1xuICAgICAgbGV0IGJpdHN0cmluZ01hdGNoUGFydCA9IHBhdHRlcm5WYWx1ZXNbaV07XG5cbiAgICAgIGlmKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpICYmXG4gICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICAgYml0c3RyaW5nTWF0Y2hQYXJ0LnNpemUgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgaSA8IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImEgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuXCIpO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmKGkgPT09IHBhdHRlcm5WYWx1ZXMubGVuZ3RoIC0gMSl7XG4gICAgICAgIGJzVmFsdWVBcnJheVBhcnQgPSBic1ZhbHVlLnZhbHVlLnNsaWNlKGJlZ2lubmluZ0luZGV4KTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgsIGJlZ2lubmluZ0luZGV4ICsgc2l6ZSk7XG4gICAgICAgIHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBwYXR0ZXJuQml0U3RyaW5nLnNsaWNlKGJlZ2lubmluZ0luZGV4LCBiZWdpbm5pbmdJbmRleCArIHNpemUpO1xuICAgICAgfVxuXG4gICAgICBpZihDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSl7XG4gICAgICAgIHN3aXRjaChiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICBpZihiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcyAmJiBiaXRzdHJpbmdNYXRjaFBhcnQuYXR0cmlidXRlcy5pbmRleE9mKFwic2lnbmVkXCIpICE9IC0xKXtcbiAgICAgICAgICAgIGFyZ3MucHVzaChuZXcgSW50OEFycmF5KFtic1ZhbHVlQXJyYXlQYXJ0WzBdXSlbMF0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICBpZihzaXplID09PSA2NCl7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH0gZWxzZSBpZihzaXplID09PSAzMil7XG4gICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgIGFyZ3MucHVzaChjcmVhdGVCaXRTdHJpbmcoYnNWYWx1ZUFycmF5UGFydCkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSkpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICBhcmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgYXJncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1lbHNlIGlmKCFhcnJheXNFcXVhbChic1ZhbHVlQXJyYXlQYXJ0LCBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGJlZ2lubmluZ0luZGV4ID0gYmVnaW5uaW5nSW5kZXggKyBzaXplO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG59XG5cbmZ1bmN0aW9uIGdldFNpemUodW5pdCwgc2l6ZSl7XG4gIHJldHVybiAodW5pdCAqIHNpemUpIC8gODtcbn1cblxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmIChhLmxlbmd0aCAhPSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsbEFycmF5KGFyciwgbnVtKXtcbiAgZm9yKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKXtcbiAgICBhcnIucHVzaCgwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVCaXRTdHJpbmcoYXJyKXtcbiAgbGV0IGludGVnZXJQYXJ0cyA9IGFyci5tYXAoKGVsZW0pID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmdcbn07XG4iLCIvKiBAZmxvdyAqL1xuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgUmVzb2x2ZXJzIGZyb20gXCIuL3Jlc29sdmVyc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRNYXRjaChwYXR0ZXJuKSB7XG5cbiAgaWYoQ2hlY2tzLmlzX3ZhcmlhYmxlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVWYXJpYWJsZShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc193aWxkY2FyZChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfdW5kZWZpbmVkKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19oZWFkVGFpbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfc3RhcnRzV2l0aChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19jYXB0dXJlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2JvdW5kKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb3VuZChwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc190eXBlKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVUeXBlKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX2FycmF5KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVBcnJheShwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19udW1iZXIocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bWJlcihwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19zdHJpbmcocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZVN0cmluZyhwYXR0ZXJuKTtcbiAgfVxuXG4gIGlmKENoZWNrcy5pc19ib29sZWFuKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX3N5bWJvbChwYXR0ZXJuKSl7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlU3ltYm9sKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYoQ2hlY2tzLmlzX251bGwocGF0dGVybikpe1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfYml0c3RyaW5nKHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcocGF0dGVybik7XG4gIH1cblxuICBpZihDaGVja3MuaXNfb2JqZWN0KHBhdHRlcm4pKXtcbiAgICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVPYmplY3QocGF0dGVybik7XG4gIH1cblxuICByZXR1cm4gUmVzb2x2ZXJzLnJlc29sdmVOb01hdGNoKCk7XG59XG4iLCJpbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhcmcpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYodHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcpe1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZy50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZihBcnJheS5pc0FycmF5KGFyZykpe1xuICAgICAgbGV0IG1hcHBlZFZhbHVlcyA9IGFyZy5tYXAoKHgpID0+IHgudG9TdHJpbmcoKSk7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH1lbHNle1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIGFyZztcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrID0gKG5ldyBFcnJvcigpKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2xhdXNlIHtcbiAgY29uc3RydWN0b3IocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSl7XG4gICAgdGhpcy5wYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgICB0aGlzLmFyaXR5ID0gcGF0dGVybi5sZW5ndGg7XG4gICAgdGhpcy5vcHRpb25hbHMgPSBnZXRPcHRpb25hbFZhbHVlcyhwYXR0ZXJuKTtcbiAgICB0aGlzLmZuID0gZm47XG4gICAgdGhpcy5ndWFyZCA9IGd1YXJkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGF1c2UocGF0dGVybiwgZm4sIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICByZXR1cm4gbmV3IENsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQpO1xufVxuXG5mdW5jdGlvbiB0cmFtcG9saW5lKGZuKXsgIFxuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgd2hpbGUocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pe1xuICAgICAgICAgICAgcmVzID0gcmVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaCguLi5jbGF1c2VzKSB7XG4gIHJldHVybiB0cmFtcG9saW5lKGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgZnVuY1RvQ2FsbCA9IG51bGw7XG4gICAgbGV0IHBhcmFtcyA9IG51bGw7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhhcmdzLCBwcm9jZXNzZWRDbGF1c2UuYXJpdHksIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHMpO1xuXG4gICAgICBpZiAocHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJiBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICBwYXJhbXMgPSByZXN1bHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gbWF0Y2ggZm9yOicsIGFyZ3MpO1xuICAgICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmNUb0NhbGwuYmluZCh0aGlzLCAuLi5wYXJhbXMpO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoZ2VuKC4uLmNsYXVzZXMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhhcmdzLCBwcm9jZXNzZWRDbGF1c2UuYXJpdHksIHByb2Nlc3NlZENsYXVzZS5vcHRpb25hbHMpO1xuXG4gICAgICBpZiAocHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KSAmJiBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgcmVzdWx0KSkge1xuICAgICAgICByZXR1cm4geWllbGQqIHByb2Nlc3NlZENsYXVzZS5mbi5hcHBseSh0aGlzLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0T3B0aW9uYWxWYWx1ZXMocGF0dGVybil7XG4gIGxldCBvcHRpb25hbHMgPSBbXTtcblxuICBmb3IobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKyl7XG4gICAgaWYocGF0dGVybltpXSBpbnN0YW5jZW9mIFR5cGVzLlZhcmlhYmxlICYmIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZSAhPSBTeW1ib2wuZm9yKFwidGFpbG9yZWQubm9fdmFsdWVcIikpe1xuICAgICAgb3B0aW9uYWxzLnB1c2goW2ksIHBhdHRlcm5baV0uZGVmYXVsdF92YWx1ZV0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvcHRpb25hbHM7XG59XG5cbmZ1bmN0aW9uIGZpbGxJbk9wdGlvbmFsVmFsdWVzKGFyZ3MsIGFyaXR5LCBvcHRpb25hbHMpe1xuICBpZihhcmdzLmxlbmd0aCA9PT0gYXJpdHkgfHwgb3B0aW9uYWxzLmxlbmd0aCA9PT0gMCl7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBpZihhcmdzLmxlbmd0aCArIG9wdGlvbmFscy5sZW5ndGggPCBhcml0eSl7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBsZXQgbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwgPSBhcml0eSAtIGFyZ3MubGVuZ3RoO1xuICBsZXQgb3B0aW9uYWxzVG9SZW1vdmUgPSBvcHRpb25hbHMubGVuZ3RoIC0gbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGw7XG5cbiAgbGV0IG9wdGlvbmFsc1RvVXNlID0gb3B0aW9uYWxzLnNsaWNlKG9wdGlvbmFsc1RvUmVtb3ZlKTtcblxuICBmb3IobGV0IFtpbmRleCwgdmFsdWVdIG9mIG9wdGlvbmFsc1RvVXNlKXtcbiAgICBhcmdzLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICAgIGlmKGFyZ3MubGVuZ3RoID09PSBhcml0eSl7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXJncztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm4sIGV4cHIsIGd1YXJkID0gKCkgPT4gdHJ1ZSkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKXtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9ZWxzZXtcbiAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgZXhwcik7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoZXhwcik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgZXhwciwgZ3VhcmQgPSAoKSA9PiB0cnVlLCBkZWZhdWx0X3ZhbHVlID0gbnVsbCkge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKXtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9ZWxzZXtcbiAgICByZXR1cm4gZGVmYXVsdF92YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgZGVmbWF0Y2gsIG1hdGNoLCBNYXRjaEVycm9yLCBDbGF1c2UsIGNsYXVzZSwgbWF0Y2hfb3JfZGVmYXVsdCwgZGVmbWF0Y2hnZW4gfSBmcm9tIFwiLi90YWlsb3JlZC9kZWZtYXRjaFwiO1xuaW1wb3J0IHsgdmFyaWFibGUsIHdpbGRjYXJkLCBzdGFydHNXaXRoLCBjYXB0dXJlLCBoZWFkVGFpbCwgdHlwZSwgYm91bmQsIGJpdFN0cmluZ01hdGNoIH0gZnJvbSBcIi4vdGFpbG9yZWQvdHlwZXNcIjtcblxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGRlZm1hdGNoLCBtYXRjaCwgTWF0Y2hFcnJvcixcbiAgdmFyaWFibGUsIHdpbGRjYXJkLCBzdGFydHNXaXRoLFxuICBjYXB0dXJlLCBoZWFkVGFpbCwgdHlwZSwgYm91bmQsXG4gIENsYXVzZSwgY2xhdXNlLCBiaXRTdHJpbmdNYXRjaCxcbiAgbWF0Y2hfb3JfZGVmYXVsdCwgZGVmbWF0Y2hnZW5cbn07XG4iXSwibmFtZXMiOlsiQ2hlY2tzLmlzX3N5bWJvbCIsIkNoZWNrcy5pc19zdHJpbmciLCJDaGVja3MuaXNfbnVtYmVyIiwiQ2hlY2tzLmlzX2Jvb2xlYW4iLCJDaGVja3MuaXNfbnVsbCIsIkNoZWNrcy5pc19hcnJheSIsIkNoZWNrcy5pc19vYmplY3QiLCJDaGVja3MuaXNfdmFyaWFibGUiLCJSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlIiwiQ2hlY2tzLmlzX3dpbGRjYXJkIiwiUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCIsIkNoZWNrcy5pc191bmRlZmluZWQiLCJDaGVja3MuaXNfaGVhZFRhaWwiLCJSZXNvbHZlcnMucmVzb2x2ZUhlYWRUYWlsIiwiQ2hlY2tzLmlzX3N0YXJ0c1dpdGgiLCJSZXNvbHZlcnMucmVzb2x2ZVN0YXJ0c1dpdGgiLCJDaGVja3MuaXNfY2FwdHVyZSIsIlJlc29sdmVycy5yZXNvbHZlQ2FwdHVyZSIsIkNoZWNrcy5pc19ib3VuZCIsIlJlc29sdmVycy5yZXNvbHZlQm91bmQiLCJDaGVja3MuaXNfdHlwZSIsIlJlc29sdmVycy5yZXNvbHZlVHlwZSIsIlJlc29sdmVycy5yZXNvbHZlQXJyYXkiLCJSZXNvbHZlcnMucmVzb2x2ZU51bWJlciIsIlJlc29sdmVycy5yZXNvbHZlU3RyaW5nIiwiUmVzb2x2ZXJzLnJlc29sdmVCb29sZWFuIiwiUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wiLCJSZXNvbHZlcnMucmVzb2x2ZU51bGwiLCJDaGVja3MuaXNfYml0c3RyaW5nIiwiUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmciLCJSZXNvbHZlcnMucmVzb2x2ZU9iamVjdCIsIlJlc29sdmVycy5yZXNvbHZlTm9NYXRjaCIsIlR5cGVzLlZhcmlhYmxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUVBLE1BQU0sUUFBTixDQUFlOztjQUVELGdCQUFnQixPQUFPLEdBQVAsQ0FBVyxtQkFBWCxDQUE1QixFQUE2RDtTQUN0RCxhQUFMLEdBQXFCLGFBQXJCOzs7O0FBSUosTUFBTSxRQUFOLENBQWU7Z0JBQ0M7OztBQUloQixNQUFNLFVBQU4sQ0FBaUI7O2NBRUgsTUFBWixFQUFvQjtTQUNiLE1BQUwsR0FBYyxNQUFkOzs7O0FBSUosTUFBTSxPQUFOLENBQWM7O2NBRUEsS0FBWixFQUFtQjtTQUNaLEtBQUwsR0FBYSxLQUFiOzs7O0FBSUosTUFBTSxRQUFOLENBQWU7Z0JBQ0M7OztBQUloQixNQUFNLElBQU4sQ0FBVzs7Y0FFRyxJQUFaLEVBQWtCLGFBQWEsRUFBL0IsRUFBbUM7U0FDNUIsSUFBTCxHQUFZLElBQVo7U0FDSyxVQUFMLEdBQWtCLFVBQWxCOzs7O0FBSUosTUFBTSxLQUFOLENBQVk7O2NBRUUsS0FBWixFQUFtQjtTQUNaLEtBQUwsR0FBYSxLQUFiOzs7O0FBSUosTUFBTSxjQUFOLENBQXFCOztjQUVQLEdBQUcsTUFBZixFQUFzQjtTQUNmLE1BQUwsR0FBYyxNQUFkOzs7V0FHTztXQUNBLE9BQU8sTUFBZDs7O2FBR1M7V0FDRixLQUFLLFNBQUwsS0FBbUIsQ0FBMUI7OztjQUdTO1FBQ0wsSUFBSSxDQUFSOztTQUVJLElBQUksR0FBUixJQUFlLEtBQUssTUFBcEIsRUFBMkI7VUFDckIsSUFBTSxJQUFJLElBQUosR0FBVyxJQUFJLElBQWhCLEdBQXNCLENBQS9COzs7V0FHSyxDQUFQOzs7V0FHTyxLQUFULEVBQWU7V0FDTixLQUFLLE1BQUwsQ0FBWSxLQUFaLENBQVA7OztpQkFHYSxLQUFmLEVBQXFCO1FBQ2YsTUFBTSxLQUFLLFFBQUwsQ0FBYyxLQUFkLENBQVY7V0FDTyxJQUFJLElBQUosR0FBVyxJQUFJ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