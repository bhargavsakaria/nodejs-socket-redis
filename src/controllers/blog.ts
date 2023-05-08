import { NextFunction, Request, Response } from 'express';

import { InternalServerError, NotFoundError } from '../helpers/apiError';
import Blog from '../entities/Blog.postgres';
import BlogTopic from '../entities/BlogTopic.postgres';
import User from '../entities/User.postgres';

export const createBlog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    const blog = req.body;
    const topic_list = [];
    for (const item of blog.topics.split(',')) {
      const item_str = item.trim().toLowerCase();
      console.log(item_str);
      if (item_str?.length) {
        const blog_topic = await BlogTopic.findOne({
          where: { name: item_str }
        });
        if (!blog_topic) {
          const newBlogTopic = await BlogTopic.create({ name: item_str });
          const savedBlogTopic = await BlogTopic.save(newBlogTopic);
          topic_list.push(savedBlogTopic);
        } else {
          topic_list.push(blog_topic);
        }
      }
    }
    const newBlog = Blog.create({ ...blog, author_id: user });
    const newBlog2 = {
      ...newBlog,
      topics: topic_list
    };
    const savedBlog = await Blog.save(newBlog2);

    res.deliver(200, 'Success', savedBlog);
  } catch (error) {
    console.log(error);
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const deleteBlog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blogId = parseInt(req.params.id);
    console.log(blogId);
    const blog = await Blog.findOne(blogId);
    console.log(blog);
    if (!blog) {
      return next(new NotFoundError('Blog is not found'));
    }

    await blog.remove();
    res.deliver(200, 'Removed blog');
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getBlogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blogs = await Blog.find({ order: { createdAt: 'DESC' } });
    // @ts-ignore
    for (let index in blogs) {
      // @ts-ignore
      blogs[index].author_name = `${blogs[index]?.author_id?.firstName} ${blogs[index]?.author_id?.lastName}`;
      // @ts-ignore
      blogs[index].author_id = blogs[index]?.author_id?.id;
    }
    console.log(blogs);
    res.deliver(200, 'Success', blogs);
  } catch (error) {
    console.log(error);
    next(new NotFoundError('Blogs not found'));
  }
};
