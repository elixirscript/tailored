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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFpbG9yZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90YWlsb3JlZC90eXBlcy5qcyIsIi4uL3NyYy90YWlsb3JlZC9jaGVja3MuanMiLCIuLi9zcmMvdGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwiLi4vc3JjL3RhaWxvcmVkL21hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2RlZm1hdGNoLmpzIiwiLi4vc3JjL3RhaWxvcmVkL2NvbXByZWhlbnNpb25zLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIEBmbG93ICovXG5cbmNsYXNzIFZhcmlhYmxlIHtcbiAgY29uc3RydWN0b3IobmFtZSA9IG51bGwsIGRlZmF1bHRfdmFsdWUgPSBTeW1ib2wuZm9yKCd0YWlsb3JlZC5ub192YWx1ZScpKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRlZmF1bHRfdmFsdWUgPSBkZWZhdWx0X3ZhbHVlO1xuICB9XG59XG5cbmNsYXNzIFdpbGRjYXJkIHtcbiAgY29uc3RydWN0b3IoKSB7fVxufVxuXG5jbGFzcyBTdGFydHNXaXRoIHtcbiAgY29uc3RydWN0b3IocHJlZml4KSB7XG4gICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gIH1cbn1cblxuY2xhc3MgQ2FwdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG59XG5cbmNsYXNzIEhlYWRUYWlsIHtcbiAgY29uc3RydWN0b3IoaGVhZCwgdGFpbCkge1xuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgfVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgb2JqUGF0dGVybiA9IHt9KSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9ialBhdHRlcm4gPSBvYmpQYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIEJvdW5kIHtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgQml0U3RyaW5nTWF0Y2gge1xuICBjb25zdHJ1Y3RvciguLi52YWx1ZXMpIHtcbiAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgfVxuXG4gIGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdmFsdWVzLmxlbmd0aDtcbiAgfVxuXG4gIGJpdF9zaXplKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVfc2l6ZSgpICogODtcbiAgfVxuXG4gIGJ5dGVfc2l6ZSgpIHtcbiAgICBsZXQgcyA9IDA7XG5cbiAgICBmb3IgKGxldCB2YWwgb2YgdGhpcy52YWx1ZXMpIHtcbiAgICAgIHMgPSBzICsgdmFsLnVuaXQgKiB2YWwuc2l6ZSAvIDg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBnZXRWYWx1ZShpbmRleCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcyhpbmRleCk7XG4gIH1cblxuICBnZXRTaXplT2ZWYWx1ZShpbmRleCkge1xuICAgIGxldCB2YWwgPSB0aGlzLmdldFZhbHVlKGluZGV4KTtcbiAgICByZXR1cm4gdmFsLnVuaXQgKiB2YWwuc2l6ZTtcbiAgfVxuXG4gIGdldFR5cGVPZlZhbHVlKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VmFsdWUoaW5kZXgpLnR5cGU7XG4gIH1cbn1cblxuY2xhc3MgTmFtZWRWYXJpYWJsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFyaWFibGUoXG4gIG5hbWUgPSBudWxsLFxuICBkZWZhdWx0X3ZhbHVlID0gU3ltYm9sLmZvcigndGFpbG9yZWQubm9fdmFsdWUnKVxuKSB7XG4gIHJldHVybiBuZXcgVmFyaWFibGUobmFtZSwgZGVmYXVsdF92YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHdpbGRjYXJkKCkge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4KSB7XG4gIHJldHVybiBuZXcgU3RhcnRzV2l0aChwcmVmaXgpO1xufVxuXG5mdW5jdGlvbiBjYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiBuZXcgQ2FwdHVyZSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGhlYWRUYWlsKGhlYWQsIHRhaWwpIHtcbiAgcmV0dXJuIG5ldyBIZWFkVGFpbChoZWFkLCB0YWlsKTtcbn1cblxuZnVuY3Rpb24gdHlwZSh0eXBlLCBvYmpQYXR0ZXJuID0ge30pIHtcbiAgcmV0dXJuIG5ldyBUeXBlKHR5cGUsIG9ialBhdHRlcm4pO1xufVxuXG5mdW5jdGlvbiBib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gbmV3IEJvdW5kKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gYml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKSB7XG4gIHJldHVybiBuZXcgQml0U3RyaW5nTWF0Y2goLi4udmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gbmFtZWRWYXJpYWJsZVJlc3VsdChuYW1lLCB2YWx1ZSkge1xuICByZXR1cm4gbmV3IE5hbWVkVmFyaWFibGVSZXN1bHQobmFtZSwgdmFsdWUpO1xufVxuXG5leHBvcnQge1xuICBWYXJpYWJsZSxcbiAgV2lsZGNhcmQsXG4gIFN0YXJ0c1dpdGgsXG4gIENhcHR1cmUsXG4gIEhlYWRUYWlsLFxuICBUeXBlLFxuICBCb3VuZCxcbiAgQml0U3RyaW5nTWF0Y2gsXG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaCxcbiAgTmFtZWRWYXJpYWJsZVJlc3VsdCxcbiAgbmFtZWRWYXJpYWJsZVJlc3VsdFxufTtcbiIsIi8qIEBmbG93ICovXG5cbmltcG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgSGVhZFRhaWwsXG4gIENhcHR1cmUsXG4gIFR5cGUsXG4gIFN0YXJ0c1dpdGgsXG4gIEJvdW5kLFxuICBCaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3R5cGVzJztcblxuZnVuY3Rpb24gaXNfbnVtYmVyKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc19zdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG5cbmZ1bmN0aW9uIGlzX2Jvb2xlYW4odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nO1xufVxuXG5mdW5jdGlvbiBpc19zeW1ib2wodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCc7XG59XG5cbmZ1bmN0aW9uIGlzX3VuZGVmaW5lZCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJztcbn1cblxuZnVuY3Rpb24gaXNfb2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnO1xufVxuXG5mdW5jdGlvbiBpc192YXJpYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZTtcbn1cblxuZnVuY3Rpb24gaXNfd2lsZGNhcmQodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2lsZGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGlzX2hlYWRUYWlsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEhlYWRUYWlsO1xufVxuXG5mdW5jdGlvbiBpc19jYXB0dXJlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhcHR1cmU7XG59XG5cbmZ1bmN0aW9uIGlzX3R5cGUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgVHlwZTtcbn1cblxuZnVuY3Rpb24gaXNfc3RhcnRzV2l0aCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBTdGFydHNXaXRoO1xufVxuXG5mdW5jdGlvbiBpc19ib3VuZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBCb3VuZDtcbn1cblxuZnVuY3Rpb24gaXNfYml0c3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEJpdFN0cmluZ01hdGNoO1xufVxuXG5mdW5jdGlvbiBpc19udWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNfYXJyYXkodmFsdWUpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBpc19mdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5mdW5jdGlvbiBpc19tYXAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgTWFwO1xufVxuXG5leHBvcnQge1xuICBpc19udW1iZXIsXG4gIGlzX3N0cmluZyxcbiAgaXNfYm9vbGVhbixcbiAgaXNfc3ltYm9sLFxuICBpc19udWxsLFxuICBpc191bmRlZmluZWQsXG4gIGlzX2Z1bmN0aW9uLFxuICBpc192YXJpYWJsZSxcbiAgaXNfd2lsZGNhcmQsXG4gIGlzX2hlYWRUYWlsLFxuICBpc19jYXB0dXJlLFxuICBpc190eXBlLFxuICBpc19zdGFydHNXaXRoLFxuICBpc19ib3VuZCxcbiAgaXNfb2JqZWN0LFxuICBpc19hcnJheSxcbiAgaXNfYml0c3RyaW5nLFxuICBpc19tYXBcbn07XG4iLCIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgKiBhcyBDaGVja3MgZnJvbSAnLi9jaGVja3MnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSAnLi9tYXRjaCc7XG5pbXBvcnQgRXJsYW5nVHlwZXMgZnJvbSAnZXJsYW5nLXR5cGVzJztcbmNvbnN0IEJpdFN0cmluZyA9IEVybGFuZ1R5cGVzLkJpdFN0cmluZztcblxuZnVuY3Rpb24gcmVzb2x2ZVN5bWJvbChwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfc3ltYm9sKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0cmluZyhwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBDaGVja3MuaXNfbnVtYmVyKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJvb2xlYW4ocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Jvb2xlYW4odmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlRnVuY3Rpb24ocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX251bGwodmFsdWUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQm91bmQocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSB0eXBlb2YgcGF0dGVybi52YWx1ZSAmJiB2YWx1ZSA9PT0gcGF0dGVybi52YWx1ZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlV2lsZGNhcmQoKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKHBhdHRlcm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBhcmdzKSB7XG4gICAgaWYgKHBhdHRlcm4ubmFtZSA9PT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKCFwYXR0ZXJuLm5hbWUuc3RhcnRzV2l0aCgnXycpKSB7XG4gICAgICBhcmdzLnB1c2goVHlwZXMubmFtZWRWYXJpYWJsZVJlc3VsdChwYXR0ZXJuLm5hbWUsIHZhbHVlKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVIZWFkVGFpbChwYXR0ZXJuKSB7XG4gIGNvbnN0IGhlYWRNYXRjaGVzID0gYnVpbGRNYXRjaChwYXR0ZXJuLmhlYWQpO1xuICBjb25zdCB0YWlsTWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi50YWlsKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZCA9IHZhbHVlWzBdO1xuICAgIGNvbnN0IHRhaWwgPSB2YWx1ZS5zbGljZSgxKTtcblxuICAgIGlmIChoZWFkTWF0Y2hlcyhoZWFkLCBhcmdzKSAmJiB0YWlsTWF0Y2hlcyh0YWlsLCBhcmdzKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQ2FwdHVyZShwYXR0ZXJuKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmIChtYXRjaGVzKHZhbHVlLCBhcmdzKSkge1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybikge1xuICBjb25zdCBwcmVmaXggPSBwYXR0ZXJuLnByZWZpeDtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoQ2hlY2tzLmlzX3N0cmluZyh2YWx1ZSkgJiYgdmFsdWUuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICBhcmdzLnB1c2godmFsdWUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVR5cGUocGF0dGVybikge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpIHtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4ub2JqUGF0dGVybik7XG4gICAgICByZXR1cm4gbWF0Y2hlcyh2YWx1ZSwgYXJncyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQXJyYXkocGF0dGVybikge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19hcnJheSh2YWx1ZSkgfHwgdmFsdWUubGVuZ3RoICE9IHBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU1hcChwYXR0ZXJuKSB7XG4gIGxldCBtYXRjaGVzID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0IGtleXMgPSBBcnJheS5mcm9tKHBhdHRlcm4ua2V5cygpKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXMuc2V0KGtleSwgYnVpbGRNYXRjaChwYXR0ZXJuLmdldChrZXkpKSk7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBpZiAoIUNoZWNrcy5pc19tYXAodmFsdWUpIHx8IHBhdHRlcm4uc2l6ZSA+IHZhbHVlLnNpemUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCF2YWx1ZS5oYXMoa2V5KSB8fCAhbWF0Y2hlcy5nZXQoa2V5KSh2YWx1ZS5nZXQoa2V5KSwgYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlT2JqZWN0KHBhdHRlcm4pIHtcbiAgbGV0IG1hdGNoZXMgPSB7fTtcblxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocGF0dGVybikuY29uY2F0KFxuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocGF0dGVybilcbiAgKTtcblxuICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgYXJncykge1xuICAgIGlmICghQ2hlY2tzLmlzX29iamVjdCh2YWx1ZSkgfHwgcGF0dGVybi5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBrZXkgb2Yga2V5cykge1xuICAgICAgaWYgKCEoa2V5IGluIHZhbHVlKSB8fCAhbWF0Y2hlc1trZXldKHZhbHVlW2tleV0sIGFyZ3MpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUJpdFN0cmluZyhwYXR0ZXJuKSB7XG4gIGxldCBwYXR0ZXJuQml0U3RyaW5nID0gW107XG5cbiAgZm9yIChsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0IG9mIHBhdHRlcm4udmFsdWVzKSB7XG4gICAgaWYgKENoZWNrcy5pc192YXJpYWJsZShiaXRzdHJpbmdNYXRjaFBhcnQudmFsdWUpKSB7XG4gICAgICBsZXQgc2l6ZSA9IGdldFNpemUoYml0c3RyaW5nTWF0Y2hQYXJ0LnVuaXQsIGJpdHN0cmluZ01hdGNoUGFydC5zaXplKTtcbiAgICAgIGZpbGxBcnJheShwYXR0ZXJuQml0U3RyaW5nLCBzaXplKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGF0dGVybkJpdFN0cmluZyA9IHBhdHRlcm5CaXRTdHJpbmcuY29uY2F0KFxuICAgICAgICBuZXcgQml0U3RyaW5nKGJpdHN0cmluZ01hdGNoUGFydCkudmFsdWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHBhdHRlcm5WYWx1ZXMgPSBwYXR0ZXJuLnZhbHVlcztcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGFyZ3MpIHtcbiAgICBsZXQgYnNWYWx1ZSA9IG51bGw7XG5cbiAgICBpZiAoIUNoZWNrcy5pc19zdHJpbmcodmFsdWUpICYmICEodmFsdWUgaW5zdGFuY2VvZiBCaXRTdHJpbmcpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENoZWNrcy5pc19zdHJpbmcodmFsdWUpKSB7XG4gICAgICBic1ZhbHVlID0gbmV3IEJpdFN0cmluZyhCaXRTdHJpbmcuYmluYXJ5KHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJzVmFsdWUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBsZXQgYmVnaW5uaW5nSW5kZXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgYml0c3RyaW5nTWF0Y2hQYXJ0ID0gcGF0dGVyblZhbHVlc1tpXTtcblxuICAgICAgaWYgKFxuICAgICAgICBDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQudHlwZSA9PSAnYmluYXJ5JyAmJlxuICAgICAgICBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIGkgPCBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDFcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ2EgYmluYXJ5IGZpZWxkIHdpdGhvdXQgc2l6ZSBpcyBvbmx5IGFsbG93ZWQgYXQgdGhlIGVuZCBvZiBhIGJpbmFyeSBwYXR0ZXJuJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICBsZXQgYnNWYWx1ZUFycmF5UGFydCA9IFtdO1xuICAgICAgbGV0IHBhdHRlcm5CaXRTdHJpbmdBcnJheVBhcnQgPSBbXTtcbiAgICAgIHNpemUgPSBnZXRTaXplKGJpdHN0cmluZ01hdGNoUGFydC51bml0LCBiaXRzdHJpbmdNYXRjaFBhcnQuc2l6ZSk7XG5cbiAgICAgIGlmIChpID09PSBwYXR0ZXJuVmFsdWVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYnNWYWx1ZUFycmF5UGFydCA9IGJzVmFsdWUudmFsdWUuc2xpY2UoYmVnaW5uaW5nSW5kZXgpO1xuICAgICAgICBwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0ID0gcGF0dGVybkJpdFN0cmluZy5zbGljZShiZWdpbm5pbmdJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBic1ZhbHVlQXJyYXlQYXJ0ID0gYnNWYWx1ZS52YWx1ZS5zbGljZShcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCxcbiAgICAgICAgICBiZWdpbm5pbmdJbmRleCArIHNpemVcbiAgICAgICAgKTtcbiAgICAgICAgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCA9IHBhdHRlcm5CaXRTdHJpbmcuc2xpY2UoXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXgsXG4gICAgICAgICAgYmVnaW5uaW5nSW5kZXggKyBzaXplXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDaGVja3MuaXNfdmFyaWFibGUoYml0c3RyaW5nTWF0Y2hQYXJ0LnZhbHVlKSkge1xuICAgICAgICBzd2l0Y2ggKGJpdHN0cmluZ01hdGNoUGFydC50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzICYmXG4gICAgICAgICAgICAgIGJpdHN0cmluZ01hdGNoUGFydC5hdHRyaWJ1dGVzLmluZGV4T2YoJ3NpZ25lZCcpICE9IC0xXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgYXJncy5wdXNoKG5ldyBJbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhcmdzLnB1c2gobmV3IFVpbnQ4QXJyYXkoW2JzVmFsdWVBcnJheVBhcnRbMF1dKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIGlmIChzaXplID09PSA2NCkge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQ2NEFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzaXplID09PSAzMikge1xuICAgICAgICAgICAgICBhcmdzLnB1c2goRmxvYXQzMkFycmF5LmZyb20oYnNWYWx1ZUFycmF5UGFydClbMF0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdiaXRzdHJpbmcnOlxuICAgICAgICAgICAgYXJncy5wdXNoKGNyZWF0ZUJpdFN0cmluZyhic1ZhbHVlQXJyYXlQYXJ0KSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGY4JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShic1ZhbHVlQXJyYXlQYXJ0KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ3V0ZjE2JzpcbiAgICAgICAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgICAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDE2QXJyYXkoYnNWYWx1ZUFycmF5UGFydCkpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICd1dGYzMic6XG4gICAgICAgICAgICBhcmdzLnB1c2goXG4gICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQzMkFycmF5KGJzVmFsdWVBcnJheVBhcnQpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghYXJyYXlzRXF1YWwoYnNWYWx1ZUFycmF5UGFydCwgcGF0dGVybkJpdFN0cmluZ0FycmF5UGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBiZWdpbm5pbmdJbmRleCA9IGJlZ2lubmluZ0luZGV4ICsgc2l6ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2l6ZSh1bml0LCBzaXplKSB7XG4gIHJldHVybiB1bml0ICogc2l6ZSAvIDg7XG59XG5cbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoYS5sZW5ndGggIT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGZpbGxBcnJheShhcnIsIG51bSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgYXJyLnB1c2goMCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQml0U3RyaW5nKGFycikge1xuICBsZXQgaW50ZWdlclBhcnRzID0gYXJyLm1hcChlbGVtID0+IEJpdFN0cmluZy5pbnRlZ2VyKGVsZW0pKTtcbiAgcmV0dXJuIG5ldyBCaXRTdHJpbmcoLi4uaW50ZWdlclBhcnRzKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU5vTWF0Y2goKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmV4cG9ydCB7XG4gIHJlc29sdmVCb3VuZCxcbiAgcmVzb2x2ZVdpbGRjYXJkLFxuICByZXNvbHZlVmFyaWFibGUsXG4gIHJlc29sdmVIZWFkVGFpbCxcbiAgcmVzb2x2ZUNhcHR1cmUsXG4gIHJlc29sdmVTdGFydHNXaXRoLFxuICByZXNvbHZlVHlwZSxcbiAgcmVzb2x2ZUFycmF5LFxuICByZXNvbHZlT2JqZWN0LFxuICByZXNvbHZlTm9NYXRjaCxcbiAgcmVzb2x2ZVN5bWJvbCxcbiAgcmVzb2x2ZVN0cmluZyxcbiAgcmVzb2x2ZU51bWJlcixcbiAgcmVzb2x2ZUJvb2xlYW4sXG4gIHJlc29sdmVGdW5jdGlvbixcbiAgcmVzb2x2ZU51bGwsXG4gIHJlc29sdmVCaXRTdHJpbmcsXG4gIHJlc29sdmVNYXBcbn07XG4iLCJpbXBvcnQgKiBhcyBSZXNvbHZlcnMgZnJvbSAnLi9yZXNvbHZlcnMnO1xuaW1wb3J0IHtcbiAgVmFyaWFibGUsXG4gIFdpbGRjYXJkLFxuICBIZWFkVGFpbCxcbiAgQ2FwdHVyZSxcbiAgVHlwZSxcbiAgU3RhcnRzV2l0aCxcbiAgQm91bmQsXG4gIEJpdFN0cmluZ01hdGNoXG59IGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBwYXR0ZXJuTWFwID0gbmV3IE1hcCgpO1xucGF0dGVybk1hcC5zZXQoVmFyaWFibGUucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZVZhcmlhYmxlKTtcbnBhdHRlcm5NYXAuc2V0KFdpbGRjYXJkLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVXaWxkY2FyZCk7XG5wYXR0ZXJuTWFwLnNldChIZWFkVGFpbC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlSGVhZFRhaWwpO1xucGF0dGVybk1hcC5zZXQoU3RhcnRzV2l0aC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RhcnRzV2l0aCk7XG5wYXR0ZXJuTWFwLnNldChDYXB0dXJlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVDYXB0dXJlKTtcbnBhdHRlcm5NYXAuc2V0KEJvdW5kLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCb3VuZCk7XG5wYXR0ZXJuTWFwLnNldChUeXBlLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVUeXBlKTtcbnBhdHRlcm5NYXAuc2V0KEJpdFN0cmluZ01hdGNoLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVCaXRTdHJpbmcpO1xucGF0dGVybk1hcC5zZXQoTnVtYmVyLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVOdW1iZXIpO1xucGF0dGVybk1hcC5zZXQoU3ltYm9sLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVTeW1ib2wpO1xucGF0dGVybk1hcC5zZXQoTWFwLnByb3RvdHlwZSwgUmVzb2x2ZXJzLnJlc29sdmVNYXApO1xucGF0dGVybk1hcC5zZXQoQXJyYXkucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUFycmF5KTtcbnBhdHRlcm5NYXAuc2V0KFN0cmluZy5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlU3RyaW5nKTtcbnBhdHRlcm5NYXAuc2V0KEJvb2xlYW4ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUJvb2xlYW4pO1xucGF0dGVybk1hcC5zZXQoRnVuY3Rpb24ucHJvdG90eXBlLCBSZXNvbHZlcnMucmVzb2x2ZUZ1bmN0aW9uKTtcbnBhdHRlcm5NYXAuc2V0KE9iamVjdC5wcm90b3R5cGUsIFJlc29sdmVycy5yZXNvbHZlT2JqZWN0KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkTWF0Y2gocGF0dGVybikge1xuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU51bGwocGF0dGVybik7XG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIFJlc29sdmVycy5yZXNvbHZlV2lsZGNhcmQocGF0dGVybik7XG4gIH1cblxuICBjb25zdCB0eXBlID0gcGF0dGVybi5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG4gIGNvbnN0IHJlc29sdmVyID0gcGF0dGVybk1hcC5nZXQodHlwZSk7XG5cbiAgaWYgKHJlc29sdmVyKSB7XG4gICAgcmV0dXJuIHJlc29sdmVyKHBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU9iamVjdChwYXR0ZXJuKTtcbiAgfVxuXG4gIHJldHVybiBSZXNvbHZlcnMucmVzb2x2ZU5vTWF0Y2goKTtcbn1cbiIsImltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tICcuL21hdGNoJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4vdHlwZXMnO1xuXG5jb25zdCBGVU5DID0gU3ltYm9sKCk7XG5cbmV4cG9ydCBjbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihhcmcpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnKSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKHggPT4ge1xuICAgICAgICBpZiAoeCA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmV0dXJuICd1bmRlZmluZWQnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHgudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgbWFwcGVkVmFsdWVzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1lc3NhZ2UgPSAnTm8gbWF0Y2ggZm9yOiAnICsgYXJnO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjaztcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENsYXVzZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4sIGZuLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuYXJpdHkgPSBwYXR0ZXJuLmxlbmd0aDtcbiAgICB0aGlzLm9wdGlvbmFscyA9IGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXVzZShwYXR0ZXJuLCBmbiwgZ3VhcmQgPSAoKSA9PiB0cnVlKSB7XG4gIHJldHVybiBuZXcgQ2xhdXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFtcG9saW5lKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmVzID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB3aGlsZSAocmVzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJlcyA9IHJlcygpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2goLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBsZXQgW2Z1bmNUb0NhbGwsIHBhcmFtc10gPSBmaW5kTWF0Y2hpbmdGdW5jdGlvbihhcmdzLCBhcml0aWVzKTtcbiAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmbWF0Y2hnZW4oLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKiguLi5hcmdzKSB7XG4gICAgbGV0IFtmdW5jVG9DYWxsLCBwYXJhbXNdID0gZmluZE1hdGNoaW5nRnVuY3Rpb24oYXJncywgYXJpdGllcyk7XG4gICAgcmV0dXJuIHlpZWxkKiBmdW5jVG9DYWxsLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaEdlbiguLi5hcmdzKSB7XG4gIHJldHVybiBkZWZtYXRjaGdlbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZm1hdGNoQXN5bmMoLi4uY2xhdXNlcykge1xuICBjb25zdCBhcml0aWVzID0gZ2V0QXJpdHlNYXAoY2xhdXNlcyk7XG5cbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJpdGllcy5oYXMoYXJncy5sZW5ndGgpKSB7XG4gICAgICBjb25zdCBhcml0eUNsYXVzZXMgPSBhcml0aWVzLmdldChhcmdzLmxlbmd0aCk7XG5cbiAgICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICAgIGxldCBwYXJhbXMgPSBudWxsO1xuICAgICAgZm9yIChsZXQgcHJvY2Vzc2VkQ2xhdXNlIG9mIGFyaXR5Q2xhdXNlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIGFyZ3MgPSBmaWxsSW5PcHRpb25hbFZhbHVlcyhcbiAgICAgICAgICBhcmdzLFxuICAgICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgICBwcm9jZXNzZWRDbGF1c2Uub3B0aW9uYWxzXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgICAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgICAgYWxsTmFtZXNNYXRjaCAmJlxuICAgICAgICAgIChhd2FpdCBwcm9jZXNzZWRDbGF1c2UuZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKVxuICAgICAgICApIHtcbiAgICAgICAgICBmdW5jVG9DYWxsID0gcHJvY2Vzc2VkQ2xhdXNlLmZuO1xuICAgICAgICAgIHBhcmFtcyA9IGZpbHRlcmVkUmVzdWx0O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghZnVuY1RvQ2FsbCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZnVuY1RvQ2FsbC5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihhcmdzKTtcbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRNYXRjaGluZ0Z1bmN0aW9uKGFyZ3MsIGFyaXRpZXMpIHtcbiAgaWYgKGFyaXRpZXMuaGFzKGFyZ3MubGVuZ3RoKSkge1xuICAgIGNvbnN0IGFyaXR5Q2xhdXNlcyA9IGFyaXRpZXMuZ2V0KGFyZ3MubGVuZ3RoKTtcblxuICAgIGxldCBmdW5jVG9DYWxsID0gbnVsbDtcbiAgICBsZXQgcGFyYW1zID0gbnVsbDtcbiAgICBmb3IgKGxldCBwcm9jZXNzZWRDbGF1c2Ugb2YgYXJpdHlDbGF1c2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBhcmdzID0gZmlsbEluT3B0aW9uYWxWYWx1ZXMoXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIHByb2Nlc3NlZENsYXVzZS5hcml0eSxcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLm9wdGlvbmFsc1xuICAgICAgKTtcblxuICAgICAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkQ2xhdXNlLnBhdHRlcm4oYXJncywgcmVzdWx0KTtcbiAgICAgIGNvbnN0IFtmaWx0ZXJlZFJlc3VsdCwgYWxsTmFtZXNNYXRjaF0gPSBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdCk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgZG9lc01hdGNoICYmXG4gICAgICAgIGFsbE5hbWVzTWF0Y2ggJiZcbiAgICAgICAgcHJvY2Vzc2VkQ2xhdXNlLmd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KVxuICAgICAgKSB7XG4gICAgICAgIGZ1bmNUb0NhbGwgPSBwcm9jZXNzZWRDbGF1c2UuZm47XG4gICAgICAgIHBhcmFtcyA9IGZpbHRlcmVkUmVzdWx0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZ1bmNUb0NhbGwpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBhcmdzKTtcbiAgICAgIHRocm93IG5ldyBNYXRjaEVycm9yKGFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiBbZnVuY1RvQ2FsbCwgcGFyYW1zXTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdBcml0eSBvZicsIGFyZ3MubGVuZ3RoLCAnbm90IGZvdW5kLiBObyBtYXRjaCBmb3I6JywgYXJncyk7XG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QXJpdHlNYXAoY2xhdXNlcykge1xuICBsZXQgbWFwID0gbmV3IE1hcCgpO1xuXG4gIGZvciAoY29uc3QgY2xhdXNlIG9mIGNsYXVzZXMpIHtcbiAgICBjb25zdCByYW5nZSA9IGdldEFyaXR5UmFuZ2UoY2xhdXNlKTtcblxuICAgIGZvciAoY29uc3QgYXJpdHkgb2YgcmFuZ2UpIHtcbiAgICAgIGxldCBhcml0eUNsYXVzZXMgPSBbXTtcblxuICAgICAgaWYgKG1hcC5oYXMoYXJpdHkpKSB7XG4gICAgICAgIGFyaXR5Q2xhdXNlcyA9IG1hcC5nZXQoYXJpdHkpO1xuICAgICAgfVxuXG4gICAgICBhcml0eUNsYXVzZXMucHVzaChjbGF1c2UpO1xuICAgICAgbWFwLnNldChhcml0eSwgYXJpdHlDbGF1c2VzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBnZXRBcml0eVJhbmdlKGNsYXVzZSkge1xuICBjb25zdCBtaW4gPSBjbGF1c2UuYXJpdHkgLSBjbGF1c2Uub3B0aW9uYWxzLmxlbmd0aDtcbiAgY29uc3QgbWF4ID0gY2xhdXNlLmFyaXR5O1xuXG4gIGxldCByYW5nZSA9IFttaW5dO1xuXG4gIHdoaWxlIChyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSAhPSBtYXgpIHtcbiAgICByYW5nZS5wdXNoKHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdICsgMSk7XG4gIH1cblxuICByZXR1cm4gcmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGdldE9wdGlvbmFsVmFsdWVzKHBhdHRlcm4pIHtcbiAgbGV0IG9wdGlvbmFscyA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKykge1xuICAgIGlmIChcbiAgICAgIHBhdHRlcm5baV0gaW5zdGFuY2VvZiBUeXBlcy5WYXJpYWJsZSAmJlxuICAgICAgcGF0dGVybltpXS5kZWZhdWx0X3ZhbHVlICE9IFN5bWJvbC5mb3IoJ3RhaWxvcmVkLm5vX3ZhbHVlJylcbiAgICApIHtcbiAgICAgIG9wdGlvbmFscy5wdXNoKFtpLCBwYXR0ZXJuW2ldLmRlZmF1bHRfdmFsdWVdKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3B0aW9uYWxzO1xufVxuXG5mdW5jdGlvbiBmaWxsSW5PcHRpb25hbFZhbHVlcyhhcmdzLCBhcml0eSwgb3B0aW9uYWxzKSB7XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gYXJpdHkgfHwgb3B0aW9uYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgaWYgKGFyZ3MubGVuZ3RoICsgb3B0aW9uYWxzLmxlbmd0aCA8IGFyaXR5KSB7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBsZXQgbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGwgPSBhcml0eSAtIGFyZ3MubGVuZ3RoO1xuICBsZXQgb3B0aW9uYWxzVG9SZW1vdmUgPSBvcHRpb25hbHMubGVuZ3RoIC0gbnVtYmVyT2ZPcHRpb25hbHNUb0ZpbGw7XG5cbiAgbGV0IG9wdGlvbmFsc1RvVXNlID0gb3B0aW9uYWxzLnNsaWNlKG9wdGlvbmFsc1RvUmVtb3ZlKTtcblxuICBmb3IgKGxldCBbaW5kZXgsIHZhbHVlXSBvZiBvcHRpb25hbHNUb1VzZSkge1xuICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAwLCB2YWx1ZSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09PSBhcml0eSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaChwYXR0ZXJuLCBleHByLCBndWFyZCA9ICgpID0+IHRydWUpIHtcbiAgbGV0IHJlc3VsdCA9IFtdO1xuICBsZXQgcHJvY2Vzc2VkUGF0dGVybiA9IGJ1aWxkTWF0Y2gocGF0dGVybik7XG4gIGNvbnN0IGRvZXNNYXRjaCA9IHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KTtcbiAgY29uc3QgW2ZpbHRlcmVkUmVzdWx0LCBhbGxOYW1lc01hdGNoXSA9IGNoZWNrTmFtZWRWYXJpYWJsZXMocmVzdWx0KTtcblxuICBpZiAoZG9lc01hdGNoICYmIGFsbE5hbWVzTWF0Y2ggJiYgZ3VhcmQuYXBwbHkodGhpcywgZmlsdGVyZWRSZXN1bHQpKSB7XG4gICAgcmV0dXJuIGZpbHRlcmVkUmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ05vIG1hdGNoIGZvcjonLCBleHByKTtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihleHByKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGVja05hbWVkVmFyaWFibGVzKHJlc3VsdHMpIHtcbiAgY29uc3QgbmFtZXNNYXAgPSB7fTtcbiAgY29uc3QgZmlsdGVyZWRSZXN1bHRzID0gW107XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHJlc3VsdHNbaV07XG4gICAgaWYgKGN1cnJlbnQgaW5zdGFuY2VvZiBUeXBlcy5OYW1lZFZhcmlhYmxlUmVzdWx0KSB7XG4gICAgICBpZiAobmFtZXNNYXBbY3VycmVudC5uYW1lXSAmJiBuYW1lc01hcFtjdXJyZW50Lm5hbWVdICE9PSBjdXJyZW50LnZhbHVlKSB7XG4gICAgICAgIHJldHVybiBbcmVzdWx0cywgZmFsc2VdO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgbmFtZXNNYXBbY3VycmVudC5uYW1lXSAmJlxuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdID09PSBjdXJyZW50LnZhbHVlXG4gICAgICApIHtcbiAgICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuYW1lc01hcFtjdXJyZW50Lm5hbWVdID0gY3VycmVudC52YWx1ZTtcbiAgICAgICAgZmlsdGVyZWRSZXN1bHRzLnB1c2goY3VycmVudC52YWx1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKGN1cnJlbnQpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBbZmlsdGVyZWRSZXN1bHRzLCB0cnVlXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHQoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGxcbikge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuXG4gIGlmIChkb2VzTWF0Y2ggJiYgYWxsTmFtZXNNYXRjaCAmJiBndWFyZC5hcHBseSh0aGlzLCBmaWx0ZXJlZFJlc3VsdCkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1hdGNoX29yX2RlZmF1bHRfYXN5bmMoXG4gIHBhdHRlcm4sXG4gIGV4cHIsXG4gIGd1YXJkID0gYXN5bmMgKCkgPT4gdHJ1ZSxcbiAgZGVmYXVsdF92YWx1ZSA9IG51bGxcbikge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgY29uc3QgZG9lc01hdGNoID0gcHJvY2Vzc2VkUGF0dGVybihleHByLCByZXN1bHQpO1xuICBjb25zdCBbZmlsdGVyZWRSZXN1bHQsIGFsbE5hbWVzTWF0Y2hdID0gY2hlY2tOYW1lZFZhcmlhYmxlcyhyZXN1bHQpO1xuICBjb25zdCBtYXRjaGVzID0gZG9lc01hdGNoICYmIGFsbE5hbWVzTWF0Y2g7XG5cbiAgaWYgKG1hdGNoZXMgJiYgKGF3YWl0IGd1YXJkLmFwcGx5KHRoaXMsIGZpbHRlcmVkUmVzdWx0KSkpIHtcbiAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRlZmF1bHRfdmFsdWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IG1hdGNoX29yX2RlZmF1bHQgfSBmcm9tIFwiLi9kZWZtYXRjaFwiO1xuaW1wb3J0IEVybGFuZ1R5cGVzIGZyb20gXCJlcmxhbmctdHlwZXNcIjtcblxuY29uc3QgTk9fTUFUQ0ggPSBTeW1ib2woKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19nZW5lcmF0b3IocGF0dGVybiwgYml0c3RyaW5nKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgbGV0IGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoMCwgcGF0dGVybi5ieXRlX3NpemUoKSk7XG4gICAgbGV0IGkgPSAxO1xuXG4gICAgd2hpbGUgKGJzU2xpY2UuYnl0ZV9zaXplID09IHBhdHRlcm4uYnl0ZV9zaXplKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoX29yX2RlZmF1bHQocGF0dGVybiwgYnNTbGljZSwgKCkgPT4gdHJ1ZSwgTk9fTUFUQ0gpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9IE5PX01BVENIKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZV0gPSByZXN1bHQ7XG4gICAgICAgIHJldHVyblJlc3VsdC5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGJzU2xpY2UgPSBiaXRzdHJpbmcuc2xpY2UoXG4gICAgICAgIHBhdHRlcm4uYnl0ZV9zaXplKCkgKiBpLFxuICAgICAgICBwYXR0ZXJuLmJ5dGVfc2l6ZSgpICogKGkgKyAxKVxuICAgICAgKTtcblxuICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2dlbmVyYXRvcihwYXR0ZXJuLCBsaXN0KSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsZXQgcmV0dXJuUmVzdWx0ID0gW107XG4gICAgZm9yIChsZXQgaSBvZiBsaXN0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaF9vcl9kZWZhdWx0KHBhdHRlcm4sIGksICgpID0+IHRydWUsIE5PX01BVENIKTtcbiAgICAgIGlmIChyZXN1bHQgIT0gTk9fTUFUQ0gpIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlXSA9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuUmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXR1cm5SZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0X2NvbXByZWhlbnNpb24oZXhwcmVzc2lvbiwgZ2VuZXJhdG9ycykge1xuICBjb25zdCBnZW5lcmF0ZWRWYWx1ZXMgPSBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3JzLnBvcCgpKCksIGdlbmVyYXRvcnMpO1xuXG4gIGxldCByZXN1bHQgPSBbXTtcblxuICBmb3IgKGxldCB2YWx1ZSBvZiBnZW5lcmF0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoZXhwcmVzc2lvbi5ndWFyZC5hcHBseSh0aGlzLCB2YWx1ZSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cHJlc3Npb24uZm4uYXBwbHkodGhpcywgdmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBydW5fZ2VuZXJhdG9ycyhnZW5lcmF0b3IsIGdlbmVyYXRvcnMpIHtcbiAgaWYgKGdlbmVyYXRvcnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yLm1hcCh4ID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgICAgIHJldHVybiB4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFt4XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsaXN0ID0gZ2VuZXJhdG9ycy5wb3AoKTtcblxuICAgIGxldCBuZXh0X2dlbiA9IFtdO1xuICAgIGZvciAobGV0IGogb2YgbGlzdCgpKSB7XG4gICAgICBmb3IgKGxldCBpIG9mIGdlbmVyYXRvcikge1xuICAgICAgICBuZXh0X2dlbi5wdXNoKFtqXS5jb25jYXQoaSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBydW5fZ2VuZXJhdG9ycyhuZXh0X2dlbiwgZ2VuZXJhdG9ycyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpdHN0cmluZ19jb21wcmVoZW5zaW9uKGV4cHJlc3Npb24sIGdlbmVyYXRvcnMpIHtcbiAgY29uc3QgZ2VuZXJhdGVkVmFsdWVzID0gcnVuX2dlbmVyYXRvcnMoZ2VuZXJhdG9ycy5wb3AoKSgpLCBnZW5lcmF0b3JzKTtcblxuICBsZXQgcmVzdWx0ID0gW107XG5cbiAgZm9yIChsZXQgdmFsdWUgb2YgZ2VuZXJhdGVkVmFsdWVzKSB7XG4gICAgaWYgKGV4cHJlc3Npb24uZ3VhcmQuYXBwbHkodGhpcywgdmFsdWUpKSB7XG4gICAgICByZXN1bHQucHVzaChleHByZXNzaW9uLmZuLmFwcGx5KHRoaXMsIHZhbHVlKSk7XG4gICAgfVxuICB9XG5cbiAgcmVzdWx0ID0gcmVzdWx0Lm1hcCh4ID0+IEVybGFuZ1R5cGVzLkJpdFN0cmluZy5pbnRlZ2VyKHgpKTtcbiAgcmV0dXJuIG5ldyBFcmxhbmdUeXBlcy5CaXRTdHJpbmcoLi4ucmVzdWx0KTtcbn1cbiIsImltcG9ydCB7XG4gIGRlZm1hdGNoLFxuICBtYXRjaCxcbiAgTWF0Y2hFcnJvcixcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIG1hdGNoX29yX2RlZmF1bHQsXG4gIG1hdGNoX29yX2RlZmF1bHRfYXN5bmMsXG4gIGRlZm1hdGNoZ2VuLFxuICBkZWZtYXRjaEdlbixcbiAgZGVmbWF0Y2hBc3luY1xufSBmcm9tICcuL3RhaWxvcmVkL2RlZm1hdGNoJztcbmltcG9ydCB7XG4gIHZhcmlhYmxlLFxuICB3aWxkY2FyZCxcbiAgc3RhcnRzV2l0aCxcbiAgY2FwdHVyZSxcbiAgaGVhZFRhaWwsXG4gIHR5cGUsXG4gIGJvdW5kLFxuICBiaXRTdHJpbmdNYXRjaFxufSBmcm9tICcuL3RhaWxvcmVkL3R5cGVzJztcblxuaW1wb3J0IHtcbiAgbGlzdF9nZW5lcmF0b3IsXG4gIGxpc3RfY29tcHJlaGVuc2lvbixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb25cbn0gZnJvbSAnLi90YWlsb3JlZC9jb21wcmVoZW5zaW9ucyc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZGVmbWF0Y2gsXG4gIG1hdGNoLFxuICBNYXRjaEVycm9yLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZCxcbiAgQ2xhdXNlLFxuICBjbGF1c2UsXG4gIGJpdFN0cmluZ01hdGNoLFxuICBtYXRjaF9vcl9kZWZhdWx0LFxuICBtYXRjaF9vcl9kZWZhdWx0X2FzeW5jLFxuICBkZWZtYXRjaGdlbixcbiAgbGlzdF9jb21wcmVoZW5zaW9uLFxuICBsaXN0X2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2dlbmVyYXRvcixcbiAgYml0c3RyaW5nX2NvbXByZWhlbnNpb24sXG4gIGRlZm1hdGNoR2VuLFxuICBkZWZtYXRjaEFzeW5jXG59O1xuIl0sIm5hbWVzIjpbIlZhcmlhYmxlIiwibmFtZSIsImRlZmF1bHRfdmFsdWUiLCJTeW1ib2wiLCJmb3IiLCJXaWxkY2FyZCIsIlN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJDYXB0dXJlIiwidmFsdWUiLCJIZWFkVGFpbCIsImhlYWQiLCJ0YWlsIiwiVHlwZSIsInR5cGUiLCJvYmpQYXR0ZXJuIiwiQm91bmQiLCJCaXRTdHJpbmdNYXRjaCIsInZhbHVlcyIsImxlbmd0aCIsImJ5dGVfc2l6ZSIsInMiLCJ2YWwiLCJ1bml0Iiwic2l6ZSIsImluZGV4IiwiZ2V0VmFsdWUiLCJOYW1lZFZhcmlhYmxlUmVzdWx0IiwidmFyaWFibGUiLCJ3aWxkY2FyZCIsInN0YXJ0c1dpdGgiLCJjYXB0dXJlIiwiaGVhZFRhaWwiLCJib3VuZCIsImJpdFN0cmluZ01hdGNoIiwibmFtZWRWYXJpYWJsZVJlc3VsdCIsImlzX251bWJlciIsImlzX3N0cmluZyIsImlzX2Jvb2xlYW4iLCJpc19zeW1ib2wiLCJpc19vYmplY3QiLCJpc192YXJpYWJsZSIsImlzX251bGwiLCJpc19hcnJheSIsIkFycmF5IiwiaXNBcnJheSIsImlzX2Z1bmN0aW9uIiwiT2JqZWN0IiwicHJvdG90eXBlIiwidG9TdHJpbmciLCJjYWxsIiwiaXNfbWFwIiwiTWFwIiwiQml0U3RyaW5nIiwiRXJsYW5nVHlwZXMiLCJyZXNvbHZlU3ltYm9sIiwicGF0dGVybiIsIkNoZWNrcyIsInJlc29sdmVTdHJpbmciLCJyZXNvbHZlTnVtYmVyIiwicmVzb2x2ZUJvb2xlYW4iLCJyZXNvbHZlRnVuY3Rpb24iLCJyZXNvbHZlTnVsbCIsInJlc29sdmVCb3VuZCIsImFyZ3MiLCJyZXNvbHZlV2lsZGNhcmQiLCJyZXNvbHZlVmFyaWFibGUiLCJwdXNoIiwiVHlwZXMiLCJyZXNvbHZlSGVhZFRhaWwiLCJoZWFkTWF0Y2hlcyIsImJ1aWxkTWF0Y2giLCJ0YWlsTWF0Y2hlcyIsInNsaWNlIiwicmVzb2x2ZUNhcHR1cmUiLCJtYXRjaGVzIiwicmVzb2x2ZVN0YXJ0c1dpdGgiLCJzdWJzdHJpbmciLCJyZXNvbHZlVHlwZSIsInJlc29sdmVBcnJheSIsIm1hcCIsIngiLCJldmVyeSIsInYiLCJpIiwicmVzb2x2ZU1hcCIsImtleXMiLCJmcm9tIiwia2V5Iiwic2V0IiwiZ2V0IiwiaGFzIiwicmVzb2x2ZU9iamVjdCIsImNvbmNhdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInJlc29sdmVCaXRTdHJpbmciLCJwYXR0ZXJuQml0U3RyaW5nIiwiYml0c3RyaW5nTWF0Y2hQYXJ0IiwiZ2V0U2l6ZSIsInBhdHRlcm5WYWx1ZXMiLCJic1ZhbHVlIiwiYmluYXJ5IiwiYmVnaW5uaW5nSW5kZXgiLCJ1bmRlZmluZWQiLCJFcnJvciIsImJzVmFsdWVBcnJheVBhcnQiLCJwYXR0ZXJuQml0U3RyaW5nQXJyYXlQYXJ0IiwiYXR0cmlidXRlcyIsImluZGV4T2YiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiRmxvYXQ2NEFycmF5IiwiRmxvYXQzMkFycmF5IiwiY3JlYXRlQml0U3RyaW5nIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiYXBwbHkiLCJVaW50MTZBcnJheSIsIlVpbnQzMkFycmF5IiwiYXJyYXlzRXF1YWwiLCJhIiwiYiIsImZpbGxBcnJheSIsImFyciIsIm51bSIsImludGVnZXJQYXJ0cyIsImVsZW0iLCJpbnRlZ2VyIiwicmVzb2x2ZU5vTWF0Y2giLCJwYXR0ZXJuTWFwIiwiUmVzb2x2ZXJzIiwiTnVtYmVyIiwiQm9vbGVhbiIsIkZ1bmN0aW9uIiwiY29uc3RydWN0b3IiLCJyZXNvbHZlciIsIk1hdGNoRXJyb3IiLCJhcmciLCJtZXNzYWdlIiwibWFwcGVkVmFsdWVzIiwic3RhY2siLCJDbGF1c2UiLCJmbiIsImd1YXJkIiwiYXJpdHkiLCJvcHRpb25hbHMiLCJnZXRPcHRpb25hbFZhbHVlcyIsImNsYXVzZSIsImRlZm1hdGNoIiwiY2xhdXNlcyIsImFyaXRpZXMiLCJnZXRBcml0eU1hcCIsImZ1bmNUb0NhbGwiLCJwYXJhbXMiLCJmaW5kTWF0Y2hpbmdGdW5jdGlvbiIsImRlZm1hdGNoZ2VuIiwiZGVmbWF0Y2hHZW4iLCJkZWZtYXRjaEFzeW5jIiwiYXJpdHlDbGF1c2VzIiwicHJvY2Vzc2VkQ2xhdXNlIiwicmVzdWx0IiwiZmlsbEluT3B0aW9uYWxWYWx1ZXMiLCJkb2VzTWF0Y2giLCJmaWx0ZXJlZFJlc3VsdCIsImFsbE5hbWVzTWF0Y2giLCJjaGVja05hbWVkVmFyaWFibGVzIiwiZXJyb3IiLCJyYW5nZSIsImdldEFyaXR5UmFuZ2UiLCJtaW4iLCJtYXgiLCJudW1iZXJPZk9wdGlvbmFsc1RvRmlsbCIsIm9wdGlvbmFsc1RvUmVtb3ZlIiwib3B0aW9uYWxzVG9Vc2UiLCJzcGxpY2UiLCJtYXRjaCIsImV4cHIiLCJwcm9jZXNzZWRQYXR0ZXJuIiwicmVzdWx0cyIsIm5hbWVzTWFwIiwiZmlsdGVyZWRSZXN1bHRzIiwiY3VycmVudCIsIm1hdGNoX29yX2RlZmF1bHQiLCJtYXRjaF9vcl9kZWZhdWx0X2FzeW5jIiwiTk9fTUFUQ0giLCJiaXRzdHJpbmdfZ2VuZXJhdG9yIiwiYml0c3RyaW5nIiwicmV0dXJuUmVzdWx0IiwiYnNTbGljZSIsImxpc3RfZ2VuZXJhdG9yIiwibGlzdCIsImxpc3RfY29tcHJlaGVuc2lvbiIsImV4cHJlc3Npb24iLCJnZW5lcmF0b3JzIiwiZ2VuZXJhdGVkVmFsdWVzIiwicnVuX2dlbmVyYXRvcnMiLCJwb3AiLCJnZW5lcmF0b3IiLCJuZXh0X2dlbiIsImoiLCJiaXRzdHJpbmdfY29tcHJlaGVuc2lvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7O0FBRUEsTUFBTUEsUUFBTixDQUFlO2NBQ0RDLE9BQU8sSUFBbkIsRUFBeUJDLGdCQUFnQkMsT0FBT0MsR0FBUCxDQUFXLG1CQUFYLENBQXpDLEVBQTBFO1NBQ25FSCxJQUFMLEdBQVlBLElBQVo7U0FDS0MsYUFBTCxHQUFxQkEsYUFBckI7Ozs7QUFJSixNQUFNRyxRQUFOLENBQWU7Z0JBQ0M7OztBQUdoQixNQUFNQyxVQUFOLENBQWlCO2NBQ0hDLE1BQVosRUFBb0I7U0FDYkEsTUFBTCxHQUFjQSxNQUFkOzs7O0FBSUosTUFBTUMsT0FBTixDQUFjO2NBQ0FDLEtBQVosRUFBbUI7U0FDWkEsS0FBTCxHQUFhQSxLQUFiOzs7O0FBSUosTUFBTUMsUUFBTixDQUFlO2NBQ0RDLElBQVosRUFBa0JDLElBQWxCLEVBQXdCO1NBQ2pCRCxJQUFMLEdBQVlBLElBQVo7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
