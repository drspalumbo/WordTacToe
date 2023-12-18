import csv
import itertools

def read_words(file_path):
    """Reads words from the given file."""
    with open(file_path, 'r') as file:
        return [line.strip() for line in file]

def read_csv(file_path):
    """Reads the crossword combinations from a CSV file."""
    with open(file_path, 'r') as csvfile:
        csv_reader = csv.reader(csvfile)
        next(csv_reader)  # Skip the header
        return [row for row in csv_reader]

def is_valid_crossword(words, word_set):
    """Checks if the given words form a valid 3x3 crossword."""
    return (words[0][0] + words[1][0] + words[2][0] in word_set and
            words[0][1] + words[1][1] + words[2][1] in word_set and
            words[0][2] + words[1][2] + words[2][2] in word_set)

def generate_valid_crosswords_from_row(row, word_set):
    """Generates valid crosswords from the given row, using only words from the word set."""
    letters = ''.join(row)
    permutations = set(itertools.permutations(letters))
    valid_crosswords = []
    for perm in permutations:
        words = [''.join(perm[0:3]), ''.join(perm[3:6]), ''.join(perm[6:9])]
        if all(word in word_set for word in words) and is_valid_crossword(words, word_set):
            valid_crosswords.append(words)
    return valid_crosswords

def process_batches(file_path, word_set, batch_size=10):
    """Processes the crossword combinations in batches."""
    rows = read_csv(file_path)
    result_file_path = 'crosswords_with_counts.csv'
    with open(result_file_path, 'w', newline='') as csvfile:
        crossword_writer = csv.writer(csvfile)
        crossword_writer.writerow(["Word 1", "Word 2", "Word 3", "Count"])
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i+batch_size]
            for row in batch:
                valid_crosswords = generate_valid_crosswords_from_row(row, word_set)
                count = len(valid_crosswords)
                crossword_writer.writerow(row + [count])
    return result_file_path

# Main execution
if __name__ == "__main__":
    word_set = set(read_words('dictionary.txt'))  # Path to your dictionary file
    output_file = process_batches('unique_crosswords.csv', word_set, batch_size=10)  # Path to your crossword combinations CSV file
    print(f"Crosswords with counts saved to: {output_file}")
