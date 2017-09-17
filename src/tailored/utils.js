import * as Checks from './checks';
import ErlangTypes from 'erlang-types';

function arrayEquals(left, right) {
  if (!Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i++) {
    if (equals(left[i], right[i]) === false) {
      return false;
    }
  }

  return true;
}

function tupleEquals(left, right) {
  if (right instanceof ErlangTypes.Tuple === false) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return arrayEquals(left.values, right.values);
}

function bitstringEquals(left, right) {
  if (right instanceof ErlangTypes.BitString === false) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return arrayEquals(left.value, right.value);
}

function pidEquals(left, right) {
  if (right instanceof ErlangTypes.PID === false) {
    return false;
  }

  return left.id === right.id;
}

function referenceEquals(left, right) {
  if (right instanceof ErlangTypes.Reference === false) {
    return false;
  }

  return left.id === right.id;
}

function mapEquals(left, right) {
  if (right instanceof Map === false) {
    return false;
  }

  const leftEntries = Array.from(left.entries());
  const rightEntries = Array.from(right.entries());

  return arrayEquals(leftEntries, rightEntries);
}

function equals(left, right) {
  if (Array.isArray(left)) {
    return arrayEquals(left, right);
  }

  if (left instanceof ErlangTypes.Tuple) {
    return tupleEquals(left, right);
  }

  if (left instanceof ErlangTypes.PID) {
    return pidEquals(left, right);
  }

  if (left instanceof ErlangTypes.BitString) {
    return bitstringEquals(left, right);
  }

  if (left instanceof ErlangTypes.Reference) {
    return referenceEquals(left, right);
  }

  if (left instanceof Map) {
    return mapEquals(left, right);
  }

  return left === right;
}

function is_non_primitive(key) {
  return (
    Checks.is_array(key) ||
    Checks.is_map(key) ||
    Checks.is_pid(key) ||
    Checks.is_reference(key) ||
    Checks.is_bitstring(key) ||
    Checks.is_tuple(key)
  );
}

function has(map, key) {
  if (is_non_primitive(key)) {
    for (const map_key of map.keys()) {
      if (equals(map_key, key)) {
        return true;
      }
    }

    return false;
  }

  return map.has(key);
}

function get(map, key) {
  if (is_non_primitive(key)) {
    for (const map_key of map.keys()) {
      if (equals(map_key, key)) {
        return map.get(map_key);
      }
    }

    return null;
  }

  return map.get(key);
}


export default {
  get,
  has,
  equals,
}
