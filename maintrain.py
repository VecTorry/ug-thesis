import tensorflow as tf
import os
import numpy as np

# Define the input and output shapes
image_size = (224, 224, 3)
pose_landmark_count = (33,)  # 33 pose landmarks

# Define the training, validation, and test directories
train_dir = 'C:\\Users\\Barrongo\\Pictures\\THESIS\\dataset\\train'
val_dir = 'C:\\Users\\Barrongo\\Pictures\\THESIS\\dataset\\val'
test_dir = 'C:\\Users\\Barrongo\\Pictures\\THESIS\\dataset\\test'

# Define the batch size and number of epochs
batch_size = 32
num_epochs = 100

# Define the data augmentation pipeline
def data_augmentation(image, label):
  image = tf.image.random_flip_left_right(image)
  image = tf.image.random_brightness(image, max_delta=0.2)
  image = tf.image.random_contrast(image, lower=0.8, upper=1.2)
  image = tf.image.random_hue(image, max_delta=0.1)
  image = tf.image.random_saturation(image, lower=0.8, upper=1.2)
  image = tf.image.resize(image, pose_landmark_count[:2])
  return image, label

# Define the training and validation datasets
train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    train_dir,
    validation_split=0.2,
    subset='training',
    seed=123,
    image_size=pose_landmark_count,
    batch_size=batch_size,
    label_mode='categorical',
    interpolation='bilinear',
)

val_ds = tf.keras.preprocessing.image_dataset_from_directory(
    val_dir,
    validation_split=0.0,
    subset='validation',
    seed=123,
    image_size=pose_landmark_count,
    batch_size=batch_size,
    label_mode='categorical',
    interpolation='bilinear',
)

# Define the test dataset
test_ds = tf.keras.preprocessing.image_dataset_from_directory(
    test_dir,
    validation_split=0.0,
    subset='validation',
    seed=123,
    image_size=pose_landmark_count,
    batch_size=batch_size,
    label_mode='categorical',
    interpolation='bilinear',
)

# Define the data normalization layer
normalization_layer = tf.keras.layers.experimental.preprocessing.Rescaling(1./255)

# Apply the normalization layer to the datasets
train_ds = train_ds.map(lambda x, y: (normalization_layer(x), y))
val_ds = val_ds.map(lambda x, y: (normalization_layer(x), y))
test_ds = test_ds.map(lambda x, y: (normalization_layer(x), y))

# Apply the data augmentation pipeline to the training dataset
train_ds = train_ds.map(data_augmentation)

# Define the model architecture
model = tf.keras.Sequential([
  tf.keras.layers.experimental.preprocessing.Rescaling(1./255, pose_landmark_count=pose_landmark_count),
  tf.keras.layers.Conv2D(16, 3, padding='same', activation='relu'),
  tf.keras.layers.MaxPooling2D(),
  tf.keras.layers.Conv2D(32, 3, padding='same', activation='relu'),
  tf.keras.layers.MaxPooling2D(),
  tf.keras.layers.Conv2D(64, 3, padding='same', activation='relu'),
  tf.keras.layers.MaxPooling2D(),
  tf.keras.layers.Flatten(),
  tf.keras.layers.Dense(512, activation='relu'),
  tf.keras.layers.Dense(pose_landmark_count, activation='softmax')
])

# Define the optimizer, loss function, and metric
optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
loss_function = tf.keras.losses.CategoricalCrossentropy()
metric = tf.keras.metrics.CategoricalAccuracy()

# Compile the model
model.compile(optimizer=optimizer, loss=loss_function, metrics=[metric])

# Train the model
history = model.fit(train_ds, validation_data=val_ds, epochs=num_epochs)

# Evaluate the model on the test dataset
loss, accuracy = model.evaluate(test_ds)
print(f'Test loss: {loss}, Test accuracy: {accuracy}')