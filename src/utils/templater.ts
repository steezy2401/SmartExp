import templates from '../constants/replyTemplates.json'
import pupa from 'pupa'

const t: Record<string, Record<string, string>> = templates
/**
 * Templates flexible text
 * 
 * @param section {string} Section name from json
 * @param message {string} Message name from json
 * @param data {object} Template data
 * @returns Templated text
 */
export function template(section: string, message: string, data: object): string {
  if (!data) return t[section][message]
  //return '123'
  return pupa(t[section][message], data);
}