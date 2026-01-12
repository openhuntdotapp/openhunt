import * as fs from 'fs';
import * as path from 'path';

export interface GFPattern {
    name: string;
    description: string;
    category: 'vulnerability' | 'secrets' | 'debug' | 'interesting';
    patterns: string[];
    flags?: string;
}

interface PatternsFile {
    patterns: GFPattern[];
}

let cachedPatterns: GFPattern[] | null = null;

export function loadPatterns(extensionPath: string): GFPattern[] {
    if (cachedPatterns) {
        return cachedPatterns;
    }
    
    try {
        const patternsPath = path.join(extensionPath, 'src', 'gf', 'patterns.json');
        const content = fs.readFileSync(patternsPath, 'utf-8');
        const data: PatternsFile = JSON.parse(content);
        cachedPatterns = data.patterns;
        return cachedPatterns;
    } catch {
        return [];
    }
}

export function getPatternsByCategory(patterns: GFPattern[], category: GFPattern['category']): GFPattern[] {
    return patterns.filter(p => p.category === category);
}

export function getAllCategories(): GFPattern['category'][] {
    return ['vulnerability', 'secrets', 'debug', 'interesting'];
}

export function findMatches(text: string, patterns: string[]): { pattern: string; matches: string[] }[] {
    const results: { pattern: string; matches: string[] }[] = [];
    
    for (const pattern of patterns) {
        try {
            const isRegex = pattern.includes('[') || pattern.includes('(') || 
                           pattern.includes('*') || pattern.includes('+') ||
                           pattern.includes('\\');
            
            let matches: string[] = [];
            
            if (isRegex) {
                const regex = new RegExp(pattern, 'gi');
                const found = text.match(regex);
                if (found) {
                    matches = [...new Set(found)];
                }
            } else {
                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`[?&]?${escapedPattern}[^&\\s"'<>]*`, 'gi');
                const found = text.match(regex);
                if (found) {
                    matches = [...new Set(found.map(m => m.replace(/^[?&]/, '')))];
                }
            }
            
            if (matches.length > 0) {
                results.push({ pattern, matches });
            }
        } catch {
            continue;
        }
    }
    
    return results;
}

export function extractAllMatches(text: string, selectedPatterns: GFPattern[]): {
    patternName: string;
    category: string;
    matches: { pattern: string; matches: string[] }[];
}[] {
    return selectedPatterns
        .map(p => ({
            patternName: p.name,
            category: p.category,
            matches: findMatches(text, p.patterns)
        }))
        .filter(r => r.matches.length > 0);
}
