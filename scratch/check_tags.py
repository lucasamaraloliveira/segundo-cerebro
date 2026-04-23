import re
import sys

def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Find opening tags (simplified)
        # Matches <div, <motion.div, etc. Avoids </ and self-closing <Tag />
        open_tags = re.finditer(r'<(div|motion\.div)\b(?![^>]*/>)', line)
        for match in open_tags:
            tag = match.group(1)
            stack.append((tag, line_num))
            # print(f"OPEN: {tag} at {line_num}")
            
        # Find closing tags
        close_tags = re.finditer(r'</(div|motion\.div)>', line)
        for match in close_tags:
            tag = match.group(1)
            if not stack:
                print(f"ERROR: Extra closing tag </{tag}> at line {line_num}")
                continue
            last_tag, last_line = stack.pop()
            if last_tag != tag:
                print(f"ERROR: Mismatch! <{last_tag}> at line {last_line} closed by </{tag}> at line {line_num}")
    
    if stack:
        print("ERROR: Unclosed tags remaining in stack:")
        for tag, line in stack:
            print(f"  <{tag}> at line {line}")
    else:
        print("SUCCESS: All tracked tags are balanced.")

if __name__ == "__main__":
    check_jsx_balance('app/page.tsx')
