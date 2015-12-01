"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveNull = exports.resolveFunction = exports.resolveBoolean = exports.resolveNumber = exports.resolveString = exports.resolveSymbol = exports.resolveNoMatch = exports.resolveObject = exports.resolveArray = exports.resolveType = exports.resolveStartsWith = exports.resolveCapture = exports.resolveHeadTail = exports.resolveVariable = exports.resolveWildcard = exports.resolveBound = undefined;

var _checks = require("./checks");

var Checks = _interopRequireWildcard(_checks);

var _types = require("./types");

var Types = _interopRequireWildcard(_types);

var _match = require("./match");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function resolveSymbol(pattern) {
  return function (value) {
    return Checks.is_symbol(value) && value === pattern;
  };
}

function resolveString(pattern) {
  return function (value) {
    return Checks.is_string(value) && value === pattern;
  };
}

function resolveNumber(pattern) {
  return function (value) {
    return Checks.is_number(value) && value === pattern;
  };
}

function resolveBoolean(pattern) {
  return function (value) {
    return Checks.is_boolean(value) && value === pattern;
  };
}

function resolveFunction(pattern) {
  return function (value) {
    return Checks.is_function(value) && value === pattern;
  };
}

function resolveNull(pattern) {
  return function (value) {
    return Checks.is_null(value);
  };
}

function resolveBound(pattern) {
  return function (value, args) {
    if ((typeof value === "undefined" ? "undefined" : _typeof(value)) === _typeof(pattern.value) && value === pattern.value) {
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
    if (!Checks.is_array(value) || value.length < 2) {
      return false;
    }

    var head = value[0];
    var tail = value.slice(1);

    args.push(head);
    args.push(tail);

    return true;
  };
}

function resolveCapture(pattern) {
  var matches = (0, _match.buildMatch)(pattern.value);

  return function (value, args) {
    if (matches(value, args)) {
      args.push(value);
      return true;
    }

    return false;
  };
}

function resolveStartsWith(pattern) {
  var prefix = pattern.prefix;

  return function (value, args) {
    if (Checks.is_string(value) && value.startsWith(prefix)) {
      args.push(value.substring(prefix.length));
      return true;
    }

    return false;
  };
}

function resolveType(pattern) {
  return function (value, args) {
    if (value instanceof pattern.type) {
      var matches = (0, _match.buildMatch)(pattern.objPattern);
      return matches(value, args) && args.push(value) > 0;
    }

    return false;
  };
}

function resolveArray(pattern) {
  var matches = pattern.map(function (x) {
    return (0, _match.buildMatch)(x);
  });

  return function (value, args) {
    if (!Checks.is_array(value) || value.length != pattern.length) {
      return false;
    }

    return value.every(function (v, i) {
      return matches[i](value[i], args);
    });
  };
}

function resolveObject(pattern) {
  var matches = {};

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = Object.keys(pattern)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      matches[key] = (0, _match.buildMatch)(pattern[key]);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return function (value, args) {
    if (!Checks.is_object(value) || pattern.length > value.length) {
      return false;
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = Object.keys(pattern)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var key = _step2.value;

        if (!(key in value) || !matches[key](value[key], args)) {
          return false;
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return true;
  };
}

function resolveNoMatch() {
  return function () {
    return false;
  };
}

exports.resolveBound = resolveBound;
exports.resolveWildcard = resolveWildcard;
exports.resolveVariable = resolveVariable;
exports.resolveHeadTail = resolveHeadTail;
exports.resolveCapture = resolveCapture;
exports.resolveStartsWith = resolveStartsWith;
exports.resolveType = resolveType;
exports.resolveArray = resolveArray;
exports.resolveObject = resolveObject;
exports.resolveNoMatch = resolveNoMatch;
exports.resolveSymbol = resolveSymbol;
exports.resolveString = resolveString;
exports.resolveNumber = resolveNumber;
exports.resolveBoolean = resolveBoolean;
exports.resolveFunction = resolveFunction;
exports.resolveNull = resolveNull;
//# sourceMappingURL=data:application/json;base64,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QUNULFlBQUcsRUFBRSxHQUFHLElBQUksS0FBSyxDQUFBLEFBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUU7QUFDckQsaUJBQU8sS0FBSyxDQUFDO1NBQ2Q7T0FDRjs7Ozs7Ozs7Ozs7Ozs7OztBQUVELFdBQU8sSUFBSSxDQUFDO0dBQ2IsQ0FBQztDQUNIOztBQUVELFNBQVMsY0FBYyxHQUFhO0FBQ2xDLFNBQU8sWUFBb0I7QUFDekIsV0FBTyxLQUFLLENBQUM7R0FDZCxDQUFDO0NBQ0g7O1FBR0MsWUFBWSxHQUFaLFlBQVk7UUFDWixlQUFlLEdBQWYsZUFBZTtRQUNmLGVBQWUsR0FBZixlQUFlO1FBQ2YsZUFBZSxHQUFmLGVBQWU7UUFDZixjQUFjLEdBQWQsY0FBYztRQUNkLGlCQUFpQixHQUFqQixpQkFBaUI7UUFDakIsV0FBVyxHQUFYLFdBQVc7UUFDWCxZQUFZLEdBQVosWUFBWTtRQUNaLGFBQWEsR0FBYixhQUFhO1FBQ2IsY0FBYyxHQUFkLGNBQWM7UUFDZCxhQUFhLEdBQWIsYUFBYTtRQUNiLGFBQWEsR0FBYixhQUFhO1FBQ2IsYUFBYSxHQUFiLGFBQWE7UUFDYixjQUFjLEdBQWQsY0FBYztRQUNkLGVBQWUsR0FBZixlQUFlO1FBQ2YsV0FBVyxHQUFYLFdBQVciLCJmaWxlIjoidGFpbG9yZWQvcmVzb2x2ZXJzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogQGZsb3cgKi9cblxuaW1wb3J0ICogYXMgQ2hlY2tzIGZyb20gXCIuL2NoZWNrc1wiO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IGJ1aWxkTWF0Y2ggfSBmcm9tIFwiLi9tYXRjaFwiO1xuXG5mdW5jdGlvbiByZXNvbHZlU3ltYm9sKHBhdHRlcm46IGFueSk6IEZ1bmN0aW9uIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX3N5bWJvbCh2YWx1ZSkgJiYgdmFsdWUgPT09IHBhdHRlcm47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVTdHJpbmcocGF0dGVybjogYW55KTogRnVuY3Rpb24ge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bWJlcihwYXR0ZXJuOiBhbnkpOiBGdW5jdGlvbiB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19udW1iZXIodmFsdWUpICYmIHZhbHVlID09PSBwYXR0ZXJuO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlQm9vbGVhbihwYXR0ZXJuOiBhbnkpOiBGdW5jdGlvbiB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZTogYW55KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIENoZWNrcy5pc19ib29sZWFuKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUZ1bmN0aW9uKHBhdHRlcm46IGFueSk6IEZ1bmN0aW9uIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlOiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gQ2hlY2tzLmlzX2Z1bmN0aW9uKHZhbHVlKSAmJiB2YWx1ZSA9PT0gcGF0dGVybjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU51bGwocGF0dGVybjogYW55KTogRnVuY3Rpb24ge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBDaGVja3MuaXNfbnVsbCh2YWx1ZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVCb3VuZChwYXR0ZXJuOiBUeXBlcy5Cb3VuZCk6IEZ1bmN0aW9uIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlOiBhbnksIGFyZ3M6IEFycmF5PGFueT4pOiBib29sZWFuIHtcbiAgICBpZih0eXBlb2YgdmFsdWUgPT09IHR5cGVvZiBwYXR0ZXJuLnZhbHVlICYmIHZhbHVlID09PSBwYXR0ZXJuLnZhbHVlKXtcbiAgICAgIGFyZ3MucHVzaCh2YWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVXaWxkY2FyZCgpOiBGdW5jdGlvbiB7XG4gIHJldHVybiBmdW5jdGlvbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVZhcmlhYmxlKCk6IEZ1bmN0aW9uIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlOiBhbnksIGFyZ3M6IEFycmF5PGFueT4pOiBib29sZWFuIHtcbiAgICBhcmdzLnB1c2godmFsdWUpO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSGVhZFRhaWwoKTogRnVuY3Rpb24ge1xuICByZXR1cm4gZnVuY3Rpb24odmFsdWU6IGFueSwgYXJnczogQXJyYXk8YW55Pik6IGJvb2xlYW4ge1xuICAgIGlmKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCA8IDIpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGhlYWQgPSB2YWx1ZVswXTtcbiAgICBjb25zdCB0YWlsID0gdmFsdWUuc2xpY2UoMSk7XG5cbiAgICBhcmdzLnB1c2goaGVhZCk7XG4gICAgYXJncy5wdXNoKHRhaWwpO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVDYXB0dXJlKHBhdHRlcm46IFR5cGVzLkNhcHR1cmUpOiBGdW5jdGlvbiB7XG4gIGNvbnN0IG1hdGNoZXMgPSBidWlsZE1hdGNoKHBhdHRlcm4udmFsdWUpO1xuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZTogYW55LCBhcmdzOiBBcnJheTxhbnk+KTogYm9vbGVhbiB7XG4gICAgaWYobWF0Y2hlcyh2YWx1ZSwgYXJncykpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVN0YXJ0c1dpdGgocGF0dGVybjogVHlwZXMuU3RhcnRzV2l0aCk6IEZ1bmN0aW9uIHtcbiAgY29uc3QgcHJlZml4ID0gcGF0dGVybi5wcmVmaXg7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlOiBhbnksIGFyZ3M6IEFycmF5PGFueT4pOiBib29sZWFuIHtcbiAgICBpZihDaGVja3MuaXNfc3RyaW5nKHZhbHVlKSAmJiB2YWx1ZS5zdGFydHNXaXRoKHByZWZpeCkpe1xuICAgICAgYXJncy5wdXNoKHZhbHVlLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVUeXBlKHBhdHRlcm46IFR5cGVzLlR5cGUpOiBGdW5jdGlvbiB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZTogYW55LCBhcmdzOiBBcnJheTxhbnk+KTogYm9vbGVhbiB7XG4gICAgaWYodmFsdWUgaW5zdGFuY2VvZiBwYXR0ZXJuLnR5cGUpe1xuICAgICAgY29uc3QgbWF0Y2hlcyA9IGJ1aWxkTWF0Y2gocGF0dGVybi5vYmpQYXR0ZXJuKTtcbiAgICAgIHJldHVybiBtYXRjaGVzKHZhbHVlLCBhcmdzKSAmJiBhcmdzLnB1c2godmFsdWUpID4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVBcnJheShwYXR0ZXJuOiBBcnJheTxhbnk+KTogRnVuY3Rpb24ge1xuICBjb25zdCBtYXRjaGVzID0gcGF0dGVybi5tYXAoeCA9PiBidWlsZE1hdGNoKHgpKTtcblxuICByZXR1cm4gZnVuY3Rpb24odmFsdWU6IGFueSwgYXJnczogQXJyYXk8YW55Pik6IGJvb2xlYW4ge1xuICAgIGlmKCFDaGVja3MuaXNfYXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCAhPSBwYXR0ZXJuLmxlbmd0aCl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlLmV2ZXJ5KGZ1bmN0aW9uKHYsIGkpIHtcbiAgICAgIHJldHVybiBtYXRjaGVzW2ldKHZhbHVlW2ldLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZU9iamVjdChwYXR0ZXJuOiBPYmplY3QpOiBGdW5jdGlvbiB7XG4gIGxldCBtYXRjaGVzID0ge307XG5cbiAgZm9yKGxldCBrZXkgb2YgT2JqZWN0LmtleXMocGF0dGVybikpe1xuICAgIG1hdGNoZXNba2V5XSA9IGJ1aWxkTWF0Y2gocGF0dGVybltrZXldKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZTogYW55LCBhcmdzOiBBcnJheTxhbnk+KTogYm9vbGVhbiB7XG4gICAgaWYoIUNoZWNrcy5pc19vYmplY3QodmFsdWUpIHx8IHBhdHRlcm4ubGVuZ3RoID4gdmFsdWUubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IGtleSBvZiBPYmplY3Qua2V5cyhwYXR0ZXJuKSl7XG4gICAgICBpZighKGtleSBpbiB2YWx1ZSkgfHwgIW1hdGNoZXNba2V5XSh2YWx1ZVtrZXldLCBhcmdzKSApe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOb01hdGNoKCk6IEZ1bmN0aW9uIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcbn1cblxuZXhwb3J0IHtcbiAgcmVzb2x2ZUJvdW5kLFxuICByZXNvbHZlV2lsZGNhcmQsXG4gIHJlc29sdmVWYXJpYWJsZSxcbiAgcmVzb2x2ZUhlYWRUYWlsLFxuICByZXNvbHZlQ2FwdHVyZSxcbiAgcmVzb2x2ZVN0YXJ0c1dpdGgsXG4gIHJlc29sdmVUeXBlLFxuICByZXNvbHZlQXJyYXksXG4gIHJlc29sdmVPYmplY3QsXG4gIHJlc29sdmVOb01hdGNoLFxuICByZXNvbHZlU3ltYm9sLFxuICByZXNvbHZlU3RyaW5nLFxuICByZXNvbHZlTnVtYmVyLFxuICByZXNvbHZlQm9vbGVhbixcbiAgcmVzb2x2ZUZ1bmN0aW9uLFxuICByZXNvbHZlTnVsbFxufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
