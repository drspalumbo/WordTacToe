import csv
import itertools

def read_words(file_path):
    """Reads words from the given file."""
    with open(file_path, 'r') as file:
        return [line.strip() for line in file]

def is_valid_crossword(words, word_set):
    """Checks if the given words form a valid 3x3 crossword."""
    return (words[0][0] + words[1][0] + words[2][0] in word_set and
            words[0][1] + words[1][1] + words[2][1] in word_set and
            words[0][2] + words[1][2] + words[2][2] in word_set)

def generate_crosswords(words):
    """Generates all valid 3x3 crosswords from the given words."""
    word_set = set(words)
    valid_crosswords = []

    for combination in itertools.product(words, repeat=3):
        if is_valid_crossword(combination, word_set):
            valid_crosswords.append(combination)

    return valid_crosswords

def save_crosswords_to_csv(crosswords, file_path):
    """Saves the crossword combinations to a CSV file."""
    with open(file_path, 'w', newline='') as csvfile:
        crossword_writer = csv.writer(csvfile)
        crossword_writer.writerow(["Word 1", "Word 2", "Word 3"])
        for crossword in crosswords:
            crossword_writer.writerow(crossword)

# Main execution
if __name__ == "__main__":
    words = read_words('dictionary.txt')  # Path to your dictionary file
    valid_crosswords = generate_crosswords(words)
    output_csv_path = 'crosswords.csv'  # Path for the output CSV file
    save_crosswords_to_csv(valid_crosswords, output_csv_path)
    print(f"Crosswords saved to: {output_csv_path}")
