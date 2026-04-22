import instaloader
import sys
import os
import shutil
import json

def fetch_reels(target_name, count=4, is_tag=True, shortcodes=None):
    L = instaloader.Instaloader(
        download_pictures=False, 
        download_videos=True, 
        download_video_thumbnails=False,
        download_geotags=False, 
        download_comments=False, 
        save_metadata=False,
        post_metadata_txt_pattern=""
    )
    
    target_dir = os.path.join("public", "reels", target_name)
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        
    try:
        found = 0
        video_links = []
        
        if is_tag:
            print(f"Searching for #{target_name}...")
            hashtag = instaloader.Hashtag.from_name(L.context, target_name)
            posts = hashtag.get_posts()
        else:
            print(f"Downloading from shortcode list for {target_name}...")
            posts = [instaloader.Post.from_shortcode(L.context, sc) for sc in (shortcodes or [])]

        for post in posts:
            if found >= count:
                break
            
            if post.is_video:
                print(f"Downloading post {post.shortcode}...")
                L.download_post(post, target=target_dir)
                
                # Normalize filename
                for file in os.listdir(target_dir):
                    if file.endswith(".mp4") and post.shortcode in file:
                        new_name = f"video_{found + 1}.mp4"
                        old_path = os.path.join(target_dir, file)
                        new_path = os.path.join(target_dir, new_name)
                        if os.path.exists(new_path): os.remove(new_path)
                        os.rename(old_path, new_path)
                        
                        video_links.append({
                            "id": found + 1,
                            "video": f"/reels/{target_name}/{new_name}",
                            "label": f"Discovery {found + 1}"
                        })
                        found += 1
                        break
        
        with open(os.path.join(target_dir, "metadata.json"), "w") as f:
            json.dump(video_links, f)
            
        print(f"Successfully downloaded {found} videos.")
        return video_links

    except Exception as e:
        print(f"Error: {e}")
        return []

if __name__ == "__main__":
    if len(sys.argv) > 2 and "," in sys.argv[2]:
        # python scripts/fetch_reels.py destination code1,code2,code3...
        codes = sys.argv[2].split(",")
        fetch_reels(sys.argv[1], is_tag=False, shortcodes=codes)
    else:
        tag = sys.argv[1] if len(sys.argv) > 1 else "azores"
        fetch_reels(tag)
