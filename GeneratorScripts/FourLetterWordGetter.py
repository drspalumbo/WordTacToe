# Read the list of words from the input file
with open("dictionary_full.txt", "r") as input_file:
    all_words = [line.strip() for line in input_file]

# Filter words with a length of exactly 3 letters
three_letter_words = [word for word in all_words if len(word) == 4]

# Save the filtered words to a new file
with open("4LetterDictionary.txt", "w") as output_file:
    for word in three_letter_words:
        output_file.write(word + "\n")

print("Filtered words saved to 4LetterDictionary.txt")
