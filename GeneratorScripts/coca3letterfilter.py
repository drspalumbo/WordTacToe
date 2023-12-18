import pandas as pd

# Path to your COCA database CSV file
file_path = 'wordFrequency.csv'

# Load the CSV file
data = pd.read_csv(file_path)

# Filter for 3-letter words
three_letter_words = data[data['word'].str.len() == 3]

# Keep only 'rank' and 'freq' columns
filtered_data = three_letter_words[['rank', 'freq']]

# Save the filtered data to a new CSV file
filtered_data.to_csv('filtered_coca_data.csv', index=False)
