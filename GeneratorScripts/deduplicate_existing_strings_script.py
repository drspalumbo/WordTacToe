
# Deduplicate the list of strings from a file

# Read the strings from a file
with open('3x3s_as_strings.txt', 'r') as file:
    strings = file.readlines()

# Remove newline characters and deduplicate
unique_strings = list(set(string.strip() for string in strings))

# Write the unique strings back to a file, each on a new line
with open('3x3s_as_string_deduplicated.txt', 'w') as file:
    for item in unique_strings:
        file.write(f"{item}\n")
