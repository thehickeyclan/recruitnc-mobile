/**
 * Marks a request as coming from the app rather than the website.
 *
 * Apple never says who downloaded the app, and it never will. What can be known is who *uses* it,
 * once they are signed in — but only if the server can tell an app request from a browser one.
 *
 * A bearer token is not that signal, tempting as it looks: the national team hub, the school
 * portal and the chat widget all send one from the website, so treating bearer as "app" would
 * count web users as app users.
 *
 * Deliberately free of any react-native import. Pulling in Platform for the OS name dragged a
 * native module into every module that sends a request, and took three test files down with it —
 * for a detail the server does not need. It only has to know this is the app.
 */
export const CLIENT_HEADER = "X-RecruitNC-Client"
export const CLIENT_HEADER_VALUE = "recruitnc-app"

export function clientHeader(): Record<string, string> {
  return { [CLIENT_HEADER]: CLIENT_HEADER_VALUE }
}
