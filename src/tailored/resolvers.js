/* @flow */

import * as Checks from './checks';
import * as Types from './types';
import { buildMatch } from './match';
import ErlangTypes from 'erlang-types';
const BitString = ErlangTypes.BitString;

function resolveSymbol(pattern) {
  return function(value) {
    return Checks.is_symbol(value) && value === pattern;
  };
}

function resolveString(pattern) {
  return function(value) {
    return Checks.is_string(value) && value === pattern;
  };
}

function resolveNumber(pattern) {
  return function(value) {
    return Checks.is_number(value) && value === pattern;
  };
}

function resolveBoolean(pattern) {
  return function(value) {
    return Checks.is_boolean(value) && value === pattern;
  };
}

function resolveFunction(pattern) {
  return function(value) {
    return Checks.is_function(value) && value === pattern;
  };
}

function resolveNull(pattern) {
  return function(value) {
    return Checks.is_null(value);
  };
}

function resolveBound(pattern) {
  return function(value, args) {
    if (typeof value === typeof pattern.value && value === pattern.value) {
      return true;
    }

    return false;
  };
}

function resolveWildcard() {
  return function() {
    return true;
  };
}

function resolveVariable(pattern) {
  return function(value, args) {
    if (pattern.name === null) {
      args.push(value);
    } else if (!pattern.name.startsWith('_')) {
      args.push(Types.namedVariableResult(pattern.name, value));
    }

    return true;
  };
}

function resolveHeadTail(pattern) {
  const headMatches = buildMatch(pattern.head);
  const tailMatches = buildMatch(pattern.tail);

  return function(value, args) {
    if (!Checks.is_array(value) || value.length === 0) {
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

  return function(value, args) {
    if (matches(value, args)) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveStartsWith(pattern) {
  const prefix = pattern.prefix;

  return function(value, args) {
    if (Checks.is_string(value) && value.startsWith(prefix)) {
      args.push(value.substring(prefix.length));
      return true;
    }

    return false;
  };
}

function resolveType(pattern) {
  return function(value, args) {
    if (value instanceof pattern.type) {
      const matches = buildMatch(pattern.objPattern);
      return matches(value, args);
    }

    return false;
  };
}

function resolveArray(pattern) {
  const matches = pattern.map(x => buildMatch(x));

  return function(value, args) {
    if (!Checks.is_array(value) || value.length != pattern.length) {
      return false;
    }

    return value.every(function(v, i) {
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

  return function(value, args) {
    if (!Checks.is_map(value) || pattern.size > value.size) {
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

  const keys = Object.keys(pattern).concat(
    Object.getOwnPropertySymbols(pattern)
  );

  for (let key of keys) {
    matches[key] = buildMatch(pattern[key]);
  }

  return function(value, args) {
    if (!Checks.is_object(value) || pattern.length > value.length) {
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
    if (Checks.is_variable(bitstringMatchPart.value)) {
      let size = getSize(bitstringMatchPart.unit, bitstringMatchPart.size);
      fillArray(patternBitString, size);
    } else {
      patternBitString = patternBitString.concat(
        new BitString(bitstringMatchPart).value
      );
    }
  }

  let patternValues = pattern.values;

  return function(value, args) {
    let bsValue = null;

    if (!Checks.is_string(value) && !(value instanceof BitString)) {
      return false;
    }

    if (Checks.is_string(value)) {
      bsValue = new BitString(BitString.binary(value));
    } else {
      bsValue = value;
    }

    let beginningIndex = 0;

    for (let i = 0; i < patternValues.length; i++) {
      let bitstringMatchPart = patternValues[i];

      if (
        Checks.is_variable(bitstringMatchPart.value) &&
        bitstringMatchPart.type == 'binary' &&
        bitstringMatchPart.size === undefined &&
        i < patternValues.length - 1
      ) {
        throw new Error(
          'a binary field without size is only allowed at the end of a binary pattern'
        );
      }

      let size = 0;
      let bsValueArrayPart = [];
      let patternBitStringArrayPart = [];
      size = getSize(bitstringMatchPart.unit, bitstringMatchPart.size);

      if (i === patternValues.length - 1) {
        bsValueArrayPart = bsValue.value.slice(beginningIndex);
        patternBitStringArrayPart = patternBitString.slice(beginningIndex);
      } else {
        bsValueArrayPart = bsValue.value.slice(
          beginningIndex,
          beginningIndex + size
        );
        patternBitStringArrayPart = patternBitString.slice(
          beginningIndex,
          beginningIndex + size
        );
      }

      if (Checks.is_variable(bitstringMatchPart.value)) {
        switch (bitstringMatchPart.type) {
          case 'integer':
            if (
              bitstringMatchPart.attributes &&
              bitstringMatchPart.attributes.indexOf('signed') != -1
            ) {
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
            args.push(
              String.fromCharCode.apply(null, new Uint8Array(bsValueArrayPart))
            );
            break;

          case 'utf8':
            args.push(
              String.fromCharCode.apply(null, new Uint8Array(bsValueArrayPart))
            );
            break;

          case 'utf16':
            args.push(
              String.fromCharCode.apply(null, new Uint16Array(bsValueArrayPart))
            );
            break;

          case 'utf32':
            args.push(
              String.fromCharCode.apply(null, new Uint32Array(bsValueArrayPart))
            );
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
  return function() {
    return false;
  };
}

export {
  resolveBound,
  resolveWildcard,
  resolveVariable,
  resolveHeadTail,
  resolveCapture,
  resolveStartsWith,
  resolveType,
  resolveArray,
  resolveObject,
  resolveNoMatch,
  resolveSymbol,
  resolveString,
  resolveNumber,
  resolveBoolean,
  resolveFunction,
  resolveNull,
  resolveBitString,
  resolveMap
};
