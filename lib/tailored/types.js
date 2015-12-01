"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Variable = function Variable() {
  var name = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

  _classCallCheck(this, Variable);

  this.name = name;
};

var Wildcard = function Wildcard() {
  _classCallCheck(this, Wildcard);
};

var StartsWith = function StartsWith(prefix) {
  _classCallCheck(this, StartsWith);

  this.prefix = prefix;
};

var Capture = function Capture(value) {
  _classCallCheck(this, Capture);

  this.value = value;
};

var HeadTail = function HeadTail() {
  _classCallCheck(this, HeadTail);
};

var Type = function Type(type) {
  var objPattern = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  _classCallCheck(this, Type);

  this.type = type;
  this.objPattern = objPattern;
};

var Bound = function Bound(value) {
  _classCallCheck(this, Bound);

  this.value = value;
};

function variable() {
  var name = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

  return new Variable(name);
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

function type(type) {
  var objPattern = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  return new Type(type, objPattern);
}

function bound(value) {
  return new Bound(value);
}

exports.Variable = Variable;
exports.Wildcard = Wildcard;
exports.StartsWith = StartsWith;
exports.Capture = Capture;
exports.HeadTail = HeadTail;
exports.Type = Type;
exports.Bound = Bound;
exports.variable = variable;
exports.wildcard = wildcard;
exports.startsWith = startsWith;
exports.capture = capture;
exports.headTail = headTail;
exports.type = type;
exports.bound = bound;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRhaWxvcmVkL3R5cGVzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0lBRU0sUUFBUSxHQUdaLFNBSEksUUFBUSxHQUdzQjtNQUF0QixJQUFhLHlEQUFHLElBQUk7O3dCQUg1QixRQUFROztBQUlWLE1BQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0NBQ2xCOztJQUdHLFFBQVEsR0FDWixTQURJLFFBQVEsR0FDRTt3QkFEVixRQUFRO0NBRVg7O0lBR0csVUFBVSxHQUdkLFNBSEksVUFBVSxDQUdGLE1BQWMsRUFBRTt3QkFIeEIsVUFBVTs7QUFJWixNQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztDQUN0Qjs7SUFHRyxPQUFPLEdBR1gsU0FISSxPQUFPLENBR0MsS0FBVSxFQUFFO3dCQUhwQixPQUFPOztBQUlULE1BQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0NBQ3BCOztJQUdHLFFBQVEsR0FDWixTQURJLFFBQVEsR0FDRTt3QkFEVixRQUFRO0NBRVg7O0lBR0csSUFBSSxHQUlSLFNBSkksSUFBSSxDQUlJLElBQVMsRUFBMkI7TUFBekIsVUFBa0IseURBQUcsRUFBRTs7d0JBSjFDLElBQUk7O0FBS04sTUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDakIsTUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7Q0FDOUI7O0lBR0csS0FBSyxHQUdULFNBSEksS0FBSyxDQUdHLEtBQVUsRUFBRTt3QkFIcEIsS0FBSzs7QUFJUCxNQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUNwQjs7QUFHSCxTQUFTLFFBQVEsR0FBaUM7TUFBaEMsSUFBYSx5REFBRyxJQUFJOztBQUNwQyxTQUFPLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzNCOztBQUVELFNBQVMsUUFBUSxHQUFhO0FBQzVCLFNBQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztDQUN2Qjs7QUFFRCxTQUFTLFVBQVUsQ0FBQyxNQUFjLEVBQWM7QUFDOUMsU0FBTyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUMvQjs7QUFFRCxTQUFTLE9BQU8sQ0FBQyxLQUFVLEVBQVc7QUFDcEMsU0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUMzQjs7QUFFRCxTQUFTLFFBQVEsR0FBYTtBQUM1QixTQUFPLElBQUksUUFBUSxFQUFFLENBQUM7Q0FDdkI7O0FBRUQsU0FBUyxJQUFJLENBQUMsSUFBUyxFQUFpQztNQUEvQixVQUFrQix5REFBRyxFQUFFOztBQUM5QyxTQUFPLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztDQUNuQzs7QUFFRCxTQUFTLEtBQUssQ0FBQyxLQUFVLEVBQVM7QUFDaEMsU0FBTyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUN6Qjs7UUFHQyxRQUFRLEdBQVIsUUFBUTtRQUNSLFFBQVEsR0FBUixRQUFRO1FBQ1IsVUFBVSxHQUFWLFVBQVU7UUFDVixPQUFPLEdBQVAsT0FBTztRQUNQLFFBQVEsR0FBUixRQUFRO1FBQ1IsSUFBSSxHQUFKLElBQUk7UUFDSixLQUFLLEdBQUwsS0FBSztRQUNMLFFBQVEsR0FBUixRQUFRO1FBQ1IsUUFBUSxHQUFSLFFBQVE7UUFDUixVQUFVLEdBQVYsVUFBVTtRQUNWLE9BQU8sR0FBUCxPQUFPO1FBQ1AsUUFBUSxHQUFSLFFBQVE7UUFDUixJQUFJLEdBQUosSUFBSTtRQUNKLEtBQUssR0FBTCxLQUFLIiwiZmlsZSI6InRhaWxvcmVkL3R5cGVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogQGZsb3cgKi9cblxuY2xhc3MgVmFyaWFibGUge1xuICBuYW1lOiA/c3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKG5hbWU6ID9zdHJpbmcgPSBudWxsKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxufVxuXG5jbGFzcyBXaWxkY2FyZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG59XG5cbmNsYXNzIFN0YXJ0c1dpdGgge1xuICBwcmVmaXg6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihwcmVmaXg6IHN0cmluZykge1xuICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICB9XG59XG5cbmNsYXNzIENhcHR1cmUge1xuICB2YWx1ZTogYW55O1xuXG4gIGNvbnN0cnVjdG9yKHZhbHVlOiBhbnkpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIH1cbn1cblxuY2xhc3MgSGVhZFRhaWwge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxufVxuXG5jbGFzcyBUeXBlIHtcbiAgdHlwZTogYW55O1xuICBvYmpQYXR0ZXJuOiBPYmplY3Q7XG5cbiAgY29uc3RydWN0b3IodHlwZTogYW55LCBvYmpQYXR0ZXJuOiBPYmplY3QgPSB7fSkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5vYmpQYXR0ZXJuID0gb2JqUGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBCb3VuZCB7XG4gIHZhbHVlOiBhbnk7XG5cbiAgY29uc3RydWN0b3IodmFsdWU6IGFueSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YXJpYWJsZShuYW1lOiA/c3RyaW5nID0gbnVsbCk6IFZhcmlhYmxlIHtcbiAgcmV0dXJuIG5ldyBWYXJpYWJsZShuYW1lKTtcbn1cblxuZnVuY3Rpb24gd2lsZGNhcmQoKTogV2lsZGNhcmQge1xuICByZXR1cm4gbmV3IFdpbGRjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGgocHJlZml4OiBzdHJpbmcpOiBTdGFydHNXaXRoIHtcbiAgcmV0dXJuIG5ldyBTdGFydHNXaXRoKHByZWZpeCk7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmUodmFsdWU6IGFueSk6IENhcHR1cmUge1xuICByZXR1cm4gbmV3IENhcHR1cmUodmFsdWUpO1xufVxuXG5mdW5jdGlvbiBoZWFkVGFpbCgpOiBIZWFkVGFpbCB7XG4gIHJldHVybiBuZXcgSGVhZFRhaWwoKTtcbn1cblxuZnVuY3Rpb24gdHlwZSh0eXBlOiBhbnksIG9ialBhdHRlcm46IE9iamVjdCA9IHt9KTogVHlwZSB7XG4gIHJldHVybiBuZXcgVHlwZSh0eXBlLCBvYmpQYXR0ZXJuKTtcbn1cblxuZnVuY3Rpb24gYm91bmQodmFsdWU6IGFueSk6IEJvdW5kIHtcbiAgcmV0dXJuIG5ldyBCb3VuZCh2YWx1ZSk7XG59XG5cbmV4cG9ydCB7XG4gIFZhcmlhYmxlLFxuICBXaWxkY2FyZCxcbiAgU3RhcnRzV2l0aCxcbiAgQ2FwdHVyZSxcbiAgSGVhZFRhaWwsXG4gIFR5cGUsXG4gIEJvdW5kLFxuICB2YXJpYWJsZSxcbiAgd2lsZGNhcmQsXG4gIHN0YXJ0c1dpdGgsXG4gIGNhcHR1cmUsXG4gIGhlYWRUYWlsLFxuICB0eXBlLFxuICBib3VuZFxufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
