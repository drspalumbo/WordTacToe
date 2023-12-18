import csv

# Initialize a list to store acceptable words
acceptable_words = []

# Read the CSV file
with open('ThreeLetterWordsMarkedByAcceptablitity.csv', mode='r') as csvfile:
    reader = csv.reader(csvfile)
    for row in reader:
        word, is_acceptable = row
        if is_acceptable.strip().upper() == 'TRUE':
            acceptable_words.append(word)

# Create a new text file to store acceptable words
with open('acceptable_words.txt', 'w') as txtfile:
    txtfile.write('\n'.join(acceptable_words))

print("Acceptable words saved to acceptable_words.txt")
