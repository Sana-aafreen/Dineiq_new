
const parseGVizJson = (json, sheetName) => {
    let cols = [];
    let rows = json.table.rows;

    // Handle case where headers are in the first row (parsedNumHeaders: 0)
    if (json.parsedNumHeaders === 0 && rows.length > 0) {
        cols = rows[0].c.map((cell) => cell?.v || "");
        rows = rows.slice(1);
        console.log("Extracted headers from row 0:", cols);
    } else {
        // Normal case: headers are in table.cols
        cols = json.table.cols.map((c, i) => c.label || c.id || `Column_${i}`);
    }

    // Ensure cols are strings and have fallbacks if empty (e.g., from row 0 having empty cells)
    cols = cols.map((c, i) => c || `Column_${i}`);

    return rows.map((row) => {
        const obj = {};
        cols.forEach((col, i) => {
            let val = row.c[i]?.v;
            if (val === undefined || val === null) val = "";

            // Boolean parsing - THIS IS THE PROBLEM FOR MENU
            if (col === "Is_Active") {
                val = val === "TRUE" || val === true || val === 1 ? true : false;
            }

            obj[col] = val;
        });
        return obj;
    });
};

const customerPreferencesJson = { "version": "0.6", "reqId": "0", "status": "ok", "sig": "1041255907", "table": { "cols": [{ "id": "A", "label": "", "type": "string" }, { "id": "B", "label": "", "type": "string" }, { "id": "C", "label": "", "type": "string" }, { "id": "D", "label": "", "type": "string" }, { "id": "E", "label": "", "type": "string" }, { "id": "F", "label": "", "type": "string" }, { "id": "G", "label": "", "type": "string" }, { "id": "H", "label": "", "type": "string" }, { "id": "I", "label": "", "type": "string" }, { "id": "J", "label": "", "type": "string" }, { "id": "K", "label": "", "type": "string" }, { "id": "L", "label": "", "type": "string" }], "rows": [{ "c": [{ "v": "Customer_ID" }, { "v": "Customer_Name" }, { "v": "Customer_Email" }, { "v": "Dietary_Type" }, { "v": "Preferred_Bread" }, { "v": "Favorite_Beverage" }, { "v": "Dessert_Preference" }, { "v": "Timestamp" }, null, null, null, { "v": null }] }, { "c": [{ "v": "Cust_0001" }, { "v": "Atharv" }, { "v": "Atharv.Kumar@webisdom.com" }, { "v": "Non-Vegetarian" }, { "v": "Naan" }, { "v": "Soda" }, { "v": "Sweets" }, { "v": "12/02/2026 00:31:01" }, null, null, null, { "v": null }] }] }, "parsedNumHeaders": 0 };

console.log("--- Testing Customer Preferences ---");
const prefResult = parseGVizJson(customerPreferencesJson, "Customer_Preferences");
console.log("Rows count:", prefResult.length);
if (prefResult.length > 0) {
    console.log("First row keys:", Object.keys(prefResult[0]));
    console.log("First row Sample:", prefResult[0]);
}

const menuJson = {
    "parsedNumHeaders": 1,
    "table": {
        "cols": [{ "label": "Item_Name" }, { "label": "Is_Active" }],
        "rows": [{ "c": [{ "v": "Burger" }, { "v": "ACTIVE" }] }]
    }
};

console.log("\n--- Testing Menu Is_Active ---");
const menuResult = parseGVizJson(menuJson, "Menu");
console.log("Menu Item:", menuResult[0]);
