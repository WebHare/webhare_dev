/* eslint-disable */
// @ts-nocheck -- Bulk rename done by wh devkit:es2ts

import * as dompack from "dompack";
import * as domevents from "dompack/src/events";
import * as whintegration from "@mod-system/js/wh/integration";
import "./splitdatetimeinput.scss";

/*
cSplitDateInput replaces date input with 3 separate number type inputs
field ordering can be set by data attribute data-dateformat

nice to have:
 - placeholder translations
 - for time input option for seconds/msec??
*/

export class cSplitDateInput {
  constructor(inpnode) {
    this.node = inpnode;
    __hideInput(inpnode);//hide current input

    let day_pos = 0;
    let month_pos = 1;
    let year_pos = 2;

    if (inpnode.dataset.dateformat) // y-m-d, d-m-y, ...
    {
      const ordering = __strToIntegerArray(inpnode.dataset.dateformat);
      for (let i = 0; i < ordering.length; ++i) {
        if (ordering[i].indexOf("y") > -1)
          year_pos = i;
        else if (ordering[i].indexOf("m") > -1)
          month_pos = i;
        else if (ordering[i].indexOf("d") > -1)
          day_pos = i;
      }
    }

    this.placeholder = {
      year: "yyyy",
      month: "mm",
      day: "dd"
    };

    if (whintegration.config.locale.indexOf("nl") > -1)
      this.placeholder = {
        year: "jjjj",
        month: "mm",
        day: "dd"
      };

    this.day = null;
    this.month = null;
    this.year = null;

    if (this.node.value != "")//Should be iso date
    {
      const parts = __strToIntegerArray(this.node.value);
      if (parts.length > 2) {
        this.day = parts[2];
        this.month = parts[1];
        this.year = parts[0];
      }
    }

    const isdisabled = this.node.disabled;
    const isreadonly = this.node.readonly;

    const day_min = 1; const day_max = 31;
    const month_min = 1; const month_max = 12;
    let year_min = 1900; let year_max = 2999;

    if (this.node.min != "") //Should be iso date
    {
      const parts = __strToIntegerArray(this.node.min);
      if (parts.length)
        year_min = parts[0];
    }

    if (this.node.max != "") {
      const parts = __strToIntegerArray(this.node.max);
      if (parts.length && parts[0] >= year_min)
        year_max = parts[0];
    }

    this.inputgroup = <div class="wh-form__dateinputgroup" />;

    this.daynode = <input disabled={isdisabled} readonly={isreadonly} pattern="[0-9]*" inputmode="numeric" autocomplete="off" maxlength="2" placeholder={this.placeholder.day} value={this.day == null ? "" : this.day} min="1" max="31" type="number" />;
    this.monthnode = <input disabled={isdisabled} readonly={isreadonly} pattern="[0-9]*" inputmode="numeric" autocomplete="off" maxlength="2" placeholder={this.placeholder.month} value={this.month == null ? "" : this.month} min="1" max="12" type="number" />;
    this.yearnode = <input disabled={isdisabled} readonly={isreadonly} pattern="[0-9]*" inputmode="numeric" autocomplete="off" maxlength="4" placeholder={this.placeholder.year} min={year_min} max={year_max} value={this.year == null ? "" : this.year} type="number" />;

    for (let i = 0; i < 3; ++i) {
      if (i == day_pos) {
        this.inputgroup.appendChild(<div class="wh-form__dateinputgroup__line day">
          {this.daynode}
        </div>); //
      }
      if (i == month_pos) {
        this.inputgroup.appendChild(<div class="wh-form__dateinputgroup__line month">
          {this.monthnode}
        </div>); //
      }
      if (i == year_pos) {
        this.inputgroup.appendChild(<div class="wh-form__dateinputgroup__line year">
          {this.yearnode}
        </div>); //
      }
    }

    //If focus on hidden date input, set focus on first field in replacement
    this.node.addEventListener("focus", ev => {
      const nextnode = this.inputgroup.querySelector("input");
      if (nextnode)
        nextnode.focus();
    });

    if (isdisabled)
      this.inputgroup.classList.add("wh-form__dateinputgroup--disabled");
    if (isreadonly)
      this.inputgroup.classList.add("wh-form__dateinputgroup--disabled");

    inpnode.parentNode.appendChild(this.inputgroup);

    this.node.addEventListener("wh:form-enable", ev => {
      dompack.toggleClass(this.inputgroup, "wh-form__dateinputgroup--disabled", ev.detail.enabled);

      this.daynode.disabled = !ev.detail.enabled;
      this.monthnode.disabled = !ev.detail.enabled;
      this.yearnode.disabled = !ev.detail.enabled;

      this.daynode.readonly = !ev.detail.enabled;
      this.monthnode.readonly = !ev.detail.enabled;
      this.yearnode.readonly = !ev.detail.enabled;
    });

    for (const node of this.inputgroup.querySelectorAll("input")) {
      node.addEventListener("blur", () => { this.inputgroup.classList.remove("focus"); });
      node.addEventListener("focus", () => { this.inputgroup.classList.add("focus"); });

      node.addEventListener("change", ev => this.onChange(ev, node));
      node.addEventListener("keyup", ev => this.onKeyUp(ev, node));
    }
  }

  onChange(ev, node) {
    const prev_day = this.day;
    const prev_month = this.month;
    const prev_year = this.year;

    if (node == this.daynode)
      __validateNumberField(this, "day", node);
    else if (node == this.monthnode)
      __validateNumberField(this, "month", node);
    else if (node == this.yearnode)
      __validateNumberField(this, "year", node);

    if (this.day != null && this.month != null && this.year != null)
      this.node.value = this.year + "-" + (this.month < 10 ? "0" : "") + this.month + "-" + (this.day < 10 ? "0" : "") + this.day;
    else
      this.node.value = "";

    const hasvalue = this.day != null && this.month != null && this.year != null;
    dompack.toggleClass(this.inputgroup, "hasvalue", hasvalue);
    dompack.toggleClass(this.inputgroup, "partlyfilled", !hasvalue && (this.day != null || this.month != null || this.year != null));

    //Trigger change event on original input
    if (prev_day != this.day || prev_month != this.month || prev_year != this.year)
      domevents.fireHTMLEvent(this.node, 'change');
  }

  onKeyUp(ev, node) {
    ev.preventDefault();
    ev.stopPropagation();

    //First some basic validation
    const value = node.value.replace(/[^0-9]+/g, '');
    if (value == "" || value != node.value || 1 * value < 1 * node.min || 1 * value > 1 * node.max)
      return;

    //Is field value minimal length
    if ((node == this.yearnode && value.length < 4) || (node != this.yearnode && value.length < 2))
      return;

    //Try to set focus on next input
    const nextnode = node.parentNode.nextSibling;
    if (!nextnode)
      return;

    const nextinp = nextnode.querySelector("input");
    if (nextinp)
      nextinp.focus();
  }
}

export class cSplitTimeInput {
  constructor(inpnode) {
    this.node = inpnode;
    __hideInput(inpnode);//hide current input

    this.placeholder = {
      hours: "hh",
      minutes: "mm",
      seconds: "ss"
    };

    if (whintegration.config.locale.indexOf("nl") > -1)
      this.placeholder = {
        hours: "uu",
        minutes: "mm",
        seconds: "ss"
      };

    this.hours = null;
    this.minutes = null;
    this.seconds = null;

    if (this.node.value != "")//Should be iso date
    {
      const parts = __strToIntegerArray(this.node.value);
      if (parts.length > 1) {
        this.hour = parts[0];
        this.minute = parts[1];

        if (this.node.dataset.whPrecision == "seconds" && parts.length > 2)
          this.seconds = parts[2];
      }
    }

    const isdisabled = this.node.disabled;
    const isreadonly = this.node.readonly;

    this.hournode = <input disabled={isdisabled} readonly={isreadonly} pattern="[0-9]*" inputmode="numeric" autocomplete="off" maxlength="2" placeholder={this.placeholder.hours} value={this.hours == null ? "" : this.hours} min="0" max="23" type="number" />;
    this.minutenode = <input disabled={isdisabled} readonly={isreadonly} pattern="[0-9]*" inputmode="numeric" autocomplete="off" maxlength="2" placeholder={this.placeholder.minutes} value={this.minutes == null ? "" : this.minutes} min="0" max="59" type="number" />;

    this.inputgroup = <div class="wh-form__timeinputgroup" tabindex="0">
      <div class="wh-form__timeinputgroup__line hour">
        {this.hournode}
      </div>
      <div class="wh-form__timeinputgroup__line minute">
        {this.minutenode}
      </div>
    </div>;

    if (this.node.dataset.whPrecision == "seconds") {
      this.secondnode = <input disabled={isdisabled} readonly={isreadonly} pattern="[0-9]*" inputmode="numeric" autocomplete="off" maxlength="2" placeholder={this.placeholder.seconds} value={this.seconds == null ? "" : this.seconds} min="0" max="59" type="number" />;
      this.inputgroup.appendChild(<div class="wh-form__timeinputgroup__line second">
        {this.secondnode}
      </div>);

      this.inputgroup.classList.add("wh-form__timeinputgroup--3col");
    }

    //If focus on hidden time input, set focus on first field in replacement
    this.node.addEventListener("focus", ev => {
      const nextnode = this.inputgroup.querySelector("input");
      if (nextnode)
        nextnode.focus();
    });

    if (isdisabled)
      this.inputgroup.classList.add("wh-form__timeinputgroup--disabled");
    if (isreadonly)
      this.inputgroup.classList.add("wh-form__timeinputgroup--disabled");

    inpnode.parentNode.appendChild(this.inputgroup);

    this.node.addEventListener("wh:form-enable", ev => {
      dompack.toggleClass(this.inputgroup, "wh-form__timeinputgroup--disabled", ev.detail.enabled);

      this.hournode.disabled = !ev.detail.enabled;
      this.minutenode.disabled = !ev.detail.enabled;
      if (this.secondnode)
        this.secondnode.disabled = !ev.detail.enabled;

      this.hournode.readonly = !ev.detail.enabled;
      this.minutenode.readonly = !ev.detail.enabled;
      if (this.secondnode)
        this.secondnode.readonly = !ev.detail.enabled;
    });

    for (const node of this.inputgroup.querySelectorAll("input")) {
      node.addEventListener("blur", () => { this.inputgroup.classList.remove("focus"); });
      node.addEventListener("focus", () => { this.inputgroup.classList.add("focus"); });

      node.addEventListener("change", ev => this.onChange(ev, node));
      node.addEventListener("keyup", ev => this.onKeyUp(ev, node));
    }
  }

  onChange(ev, node) {
    const prev_hours = this.hours;
    const prev_minutes = this.minutes;
    const prev_seconds = this.seconds;

    if (node == this.hournode)
      __validateNumberField(this, "hours", node);
    else if (node == this.minutenode) {
      __validateNumberField(this, "minutes", node);
      if (node.value.length == 1)
        node.value = "0" + node.value;
    } else if (node == this.secondnode) {
      __validateNumberField(this, "seconds", node);
      if (node.value.length == 1)
        node.value = "0" + node.value;
    }

    if (this.hours != null && this.minutes != null)
      this.node.value = (this.hours < 10 ? "0" : "") + this.hours + (this.minutes < 10 ? ":0" : ":") + this.minutes;
    else
      this.node.value = "";

    let hasvalue = this.hours != null && this.minutes != null;
    if (hasvalue && this.secondnode && this.seconds == null)
      hasvalue = false;
    dompack.toggleClass(this.inputgroup, "hasvalue", hasvalue);
    dompack.toggleClass(this.inputgroup, "partlyfilled", !hasvalue && (this.hours != null || this.minutes != null || (this.secondnode && this.seconds != null)));

    //Trigger change event on original input
    if (prev_hours != this.hours || prev_minutes != this.minutes || prev_seconds != this.seconds)
      domevents.fireHTMLEvent(this.node, 'change');
  }

  onKeyUp(ev, node) {
    ev.preventDefault();
    ev.stopPropagation();

    //First some basic validation
    const value = node.value.replace(/[^0-9]+/g, '');
    if (value == "" || value != node.value || 1 * value < 1 * node.min || 1 * value > 1 * node.max)
      return;

    //Is field value minimal length
    if (value.length < 2)
      return;

    //Try to set focus on next input
    const nextnode = node.parentNode.nextSibling;
    if (!nextnode)
      return;

    const nextinp = nextnode.querySelector("input");
    if (nextinp)
      nextinp.focus();
  }
}


function __strToIntegerArray(str) {
  const ilist = [];
  const parts = str.split(/[^0-9]+/);
  for (let i = 0; i < parts.length; ++i)
    ilist.push(1 * parts[i]);

  return ilist;
}


function __validateNumberField(self, fieldname, node) {
  const value = node.value.replace(/[^0-9]+/g, '');
  node.value = value;

  if (value != "")
    self[fieldname] = 1 * value;
  else
    self[fieldname] = null;
}


function __hideInput(node) {
  node.style.display = "block";
  node.style.position = "absolute";
  node.style.left = "-9999px";
  node.style.width = "0px";
  node.style.height = "0px";
}
