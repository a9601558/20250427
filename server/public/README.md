# Static Assets Directory

This directory is used to serve static files for the application.

## Images

Place image files in the `images/` directory. The application expects the following images:

- `banner.jpg` - The homepage banner image (recommended size: 1200x300px)

Example usage in the application:
```
bannerImage: "/images/banner.jpg"
```

## How to Add Images

1. Ensure the `images/` directory exists:
   ```
   mkdir -p public/images
   ```

2. Place your image files directly in the `images/` directory.

3. Access the images from the frontend at `/images/your-image-name.jpg`.

## Banner Image

If you're seeing broken images for the banner, please add a banner.jpg file to the images directory. 
You can update the banner image through the admin interface after adding an initial image. 