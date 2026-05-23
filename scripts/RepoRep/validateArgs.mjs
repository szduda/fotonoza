/// <reference path="./types.mjs" />
import { format, isValid, parse, subDays } from "date-fns";
import { UTCDate } from "@date-fns/utc";

export const DATE_ARG_FORMAT = "yyMMddHHmm";

function parseDateArg(token) {
  const d = parse(token, DATE_ARG_FORMAT, new UTCDate());
  if (!isValid(d) || format(d, DATE_ARG_FORMAT) !== token) {
    throw new Error(`Invalid calendar values in token: ${token}`);
  }
  return d;
}

/** @returns {ProcessArgs} */
export function getProcessArgs() {
  const start = process.argv[2]?.trim() ?? "";
  const end = process.argv[3]?.trim() ?? "";
  const now = new UTCDate();
  const startDate = start ? parseDateArg(start) : subDays(now, 1);
  const endDate = end ? parseDateArg(end) : now;

  if (startDate.getTime() >= endDate.getTime()) {
    throw new Error("End must be after start (UTC).");
  }

  return {
    start: format(startDate, DATE_ARG_FORMAT),
    end: format(endDate, DATE_ARG_FORMAT),
    startDate,
    endDate,
  };
}
