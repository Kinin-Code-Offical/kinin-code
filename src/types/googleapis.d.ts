declare module "googleapis" {
    type SheetsAppendRequest = {
        spreadsheetId: string;
        range: string;
        valueInputOption: "RAW";
        insertDataOption: "INSERT_ROWS";
        requestBody: {
            values: string[][];
        };
    };

    export const google: {
        auth: {
            JWT: new (args: { email: string; key: string; scopes: string[] }) => unknown;
            GoogleAuth: new (args: { scopes: string[] }) => unknown;
        };
        sheets: (args: { version: "v4"; auth: unknown }) => {
            spreadsheets: {
                values: {
                    append: (args: SheetsAppendRequest) => Promise<unknown>;
                };
            };
        };
    };
}
