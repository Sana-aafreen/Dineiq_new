import { parse, isValid } from "date-fns";

/**
 * Safely parse a price value that may contain thousands-separator commas.
 * e.g. "1,200" → 1200,  1200 → 1200,  "" → 0,  undefined → 0
 */
export const parsePrice = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

export const parseGVizJson = (json: any, sheetName: string) => {
  let cols: string[] = [];
  let rows = json.table.rows;

  // Detect if headers are in the first row
  // conditions: explicitly parsedNumHeaders is 0, OR all column labels are empty strings
  const labelsEmpty = json.table.cols.every((c: any) => !c.label || c.label.trim() === "");
  const hasData = rows.length > 0;

  if ((json.parsedNumHeaders === 0 || labelsEmpty) && hasData) {
    // Use first row as headers
    cols = rows[0].c.map((cell: any) => cell?.v || "");
    rows = rows.slice(1);
  } else {
    // Normal case: headers are in table.cols
    cols = json.table.cols.map((c: any, i: number) => {
      let label = c.label || c.id || `Column_${i}`;
      // Fix for Google Sheets merging header and first row data in label
      // e.g. "Campaign_ID Cmp_0001" -> "Campaign_ID"
      // e.g. "Message_Template #1 My Message" -> "Message_Template #1"
      if (label.includes(" ")) {
        const parts = label.split(" ");
        // If part 1 looks like an index (#1), join it back to part 0
        if (parts[1] && parts[1].startsWith("#")) {
          label = `${parts[0]} ${parts[1]}`;
        } else if (parts[0] && /^[a-zA-Z0-9_#]+$/.test(parts[0])) {
          label = parts[0];
        }
      }
      return label;
    });
  }

  // Ensure cols are strings and have fallbacks if empty
  cols = cols.map((c, i) => String(c || `Column_${i}`).trim());

  return rows.map((row: any) => {
    const obj: Record<string, any> = {};
    cols.forEach((col: string, i: number) => {
      let val = row.c?.[i]?.v; // Safer access
      if (val === undefined || val === null) val = "";

      // Removed Is_Active boolean coercion as it might be "ACTIVE"/"INACTIVE" string

      // Date-time cols to check
      const dateCols = [
        "Date_of_Birth", "Creation_DateTime", "Last_Login_DateTime",
        "Order_Created_DateTime", "Campaign_Start_DateTime", "Campaign_End_DateTime",
        "Timestamp", "Chat_Date_Time"
      ];

      // Check generic type from Gviz
      const colType = json.table.cols[i]?.type;

      if (dateCols.includes(col) || colType === "date" || colType === "datetime") {
        val = parseFlexibleDate(val);
      } else if (colType === "timeofday" || Array.isArray(val)) {
        val = parseTimeOfDay(val);
      }

      obj[col] = val;
      // Also provide index-based access for safety if needed
      obj[`__col_${i}`] = val;
    });
    return obj;
  });
};

function parseFlexibleDate(val: any): string {
  if (!val) return "";

  // 1. Handle actual Date object (rare in Gviz JSON but possible in some contexts)
  if (val instanceof Date) return val.toISOString();

  // 2. Handle Gviz "Date(y,m,d,h,m,s)" string
  if (typeof val === "string" && val.startsWith("Date(")) {
    const parts = val.match(/\d+/g);
    if (parts) {
      const nums = parts.map(Number);
      // Date(year, month, day, hour, minute, second) -> Month is 0-indexed
      const d = new Date(nums[0], nums[1], nums[2] || 1, nums[3] || 0, nums[4] || 0, nums[5] || 0);
      return d.toISOString();
    }
  }

  // 3. Handle string formats using date-fns
  if (typeof val === "string") {
    // Clean string
    const cleanVal = val.replace(/^['"]+|['"]+$/g, "").trim();
    if (!cleanVal) return "";

    // Specific formats to try
    // Prioritize DD/MM/YYYY as seen in Orders
    const formats = [
      "dd/MM/yyyy HH:mm:ss",
      "dd/MM/yyyy HH:mm",
      "dd/MM/yyyy",
      "MM/dd/yyyy HH:mm:ss",
      "MM/dd/yyyy",
      "yyyy-MM-dd HH:mm:ss",
      "yyyy-MM-dd HH:mm",
      "yyyy-MM-dd",
    ];

    const now = new Date();
    for (const fmt of formats) {
      const parsed = parse(cleanVal, fmt, now);
      if (isValid(parsed)) return parsed.toISOString();
    }

    // 4. Fallback to native Date parsing (ISO strings, etc)
    const nativeParams = Date.parse(cleanVal);
    if (!isNaN(nativeParams)) {
      return new Date(nativeParams).toISOString();
    }
  }

  // Return original if parsing failed (or maybe empty string to be safe?)
  // Returning original allows UI to show "Invalid" or raw text instead of crashing
  return val;
}

function parseTimeOfDay(val: any): string {
  if (Array.isArray(val)) {
    // [hour, minute, second, millis]
    const [h, m, s] = val;
    return `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}`;
  }
  return val;
}
