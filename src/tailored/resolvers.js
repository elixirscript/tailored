/* @flow */

import * as Checks from "./checks";
import * as Types from "./types";
import { buildMatch } from "./match";

function resolveSymbol(pattern){
  return function(value){
    return Checks.is_symbol(value) && value === pattern;
  };
}

function resolveString(pattern){
  return function(value){
    return Checks.is_string(value) && value === pattern;
  };
}

function resolveNumber(pattern){
  return function(value){
    return Checks.is_number(value) && value === pattern;
  };
}

function resolveBoolean(pattern){
  return function(value){
    return Checks.is_boolean(value) && value === pattern;
  };
}

function resolveFunction(pattern){
  return function(value){
    return Checks.is_function(value) && value === pattern;
  };
}

function resolveNull(pattern){
  return function(value){
    return Checks.is_null(value);
  };
}

function resolveBound(pattern){
  return function(value, args){
    if(typeof value === typeof pattern.value && value === pattern.value){
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveWildcard(){
  return function() {
    return true;
  };
}

function resolveVariable(){
  return function(value, args){
    args.push(value);
    return true;
  };
}

function resolveHeadTail() {
  return function(value, args) {
    if(!Checks.is_array(value) || value.length < 2){
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

  return function(value, args) {
    if(matches(value, args)){
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveStartsWith(pattern) {
  const prefix = pattern.prefix;

  return function(value, args) {
    if(Checks.is_string(value) && value.startsWith(prefix)){
      args.push(value.substring(prefix.length));
      return true;
    }

    return false;
  };
}

function resolveType(pattern) {
  return function(value, args) {
    if(value instanceof pattern.type){
      const matches = buildMatch(pattern.objPattern);
      return matches(value, args) && args.push(value) > 0;
    }

    return false;
  };
}

function resolveArray(pattern) {
  const matches = pattern.map(x => buildMatch(x));

  return function(value, args) {
    if(!Checks.is_array(value) || value.length != pattern.length){
      return false;
    }

    return value.every(function(v, i) {
      return matches[i](value[i], args);
    });
  };
}

function resolveObject(pattern) {
  let matches = {};

  for(let key of Object.keys(pattern)){
    matches[key] = buildMatch(pattern[key]);
  }

  return function(value, args) {
    if(!Checks.is_object(value) || pattern.length > value.length){
      return false;
    }

    for(let key of Object.keys(pattern)){
      if(!(key in value) || !matches[key](value[key], args) ){
        return false;
      }
    }

    return true;
  };
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
  resolveNull
};
