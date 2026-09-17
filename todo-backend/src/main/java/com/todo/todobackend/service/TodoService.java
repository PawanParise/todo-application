package com.todo.todobackend.service;

import com.todo.todobackend.exception.TodoNotFoundException;
import com.todo.todobackend.model.Todo;
import com.todo.todobackend.model.User;
import com.todo.todobackend.repository.TodoRepository;
import com.todo.todobackend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@Transactional
public class TodoService {

    private final TodoRepository todoRepository;
    private final UserRepository userRepository;

    public TodoService(TodoRepository todoRepository, UserRepository userRepository) {
        this.todoRepository = todoRepository;
        this.userRepository = userRepository;
    }

    // Get todos by user ID
    public List<Todo> getTodosByUserId(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        return todoRepository.findByUserIdOrderByIdDesc(userId);
    }

    // Backward compatibility if ever called without user
    public List<Todo> getAllTodos() {
        return todoRepository.findAll();
    }

    // Create todo linked to user
    public Todo createTodo(Todo todo, Long userId) {
        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
            todo.setUser(user);
        }
        return todoRepository.save(todo);
    }

    // Legacy create todo
    public Todo createTodo(Todo todo) {
        return todoRepository.save(todo);
    }

    // Get todo by ID
    public Todo getTodoById(Long id) {
        return todoRepository.findById(id)
                .orElseThrow(() -> new TodoNotFoundException(id));
    }

    // Update todo with ownership check
    public Todo updateTodo(Long id, Todo updatedTodo, Long userId) {
        Todo existingTodo = todoRepository.findById(id)
                .orElseThrow(() -> new TodoNotFoundException(id));

        if (userId != null && existingTodo.getUser() != null && !existingTodo.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized: You can only edit your own tasks.");
        }

        existingTodo.setTitle(updatedTodo.getTitle());
        existingTodo.setDescription(updatedTodo.getDescription());
        existingTodo.setCompleted(updatedTodo.isCompleted());
        existingTodo.setDueDate(updatedTodo.getDueDate());
        existingTodo.setDueTime(updatedTodo.getDueTime());

        // If reminder time has changed or is newly set, reset reminderSent
        if (updatedTodo.getReminderDateTime() != null &&
                !updatedTodo.getReminderDateTime().equals(existingTodo.getReminderDateTime())) {
            existingTodo.setReminderSent(false);
        }
        existingTodo.setReminderDateTime(updatedTodo.getReminderDateTime());
        existingTodo.setReminderEmail(updatedTodo.getReminderEmail());

        if (updatedTodo.getImageData() != null) {
            existingTodo.setImageData(updatedTodo.getImageData());
            existingTodo.setImageType(updatedTodo.getImageType());
        }

        // If previously unassigned, assign to current user
        if (existingTodo.getUser() == null && userId != null) {
            userRepository.findById(userId).ifPresent(existingTodo::setUser);
        }

        return todoRepository.save(existingTodo);
    }

    // Snooze reminder by X minutes
    public Todo snoozeTodo(Long id, int minutes, Long userId) {
        Todo existingTodo = todoRepository.findById(id)
                .orElseThrow(() -> new TodoNotFoundException(id));

        if (userId != null && existingTodo.getUser() != null && !existingTodo.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized: You can only snooze your own tasks.");
        }

        java.time.LocalDateTime newTime = java.time.LocalDateTime.now().plusMinutes(minutes);
        existingTodo.setReminderDateTime(newTime);
        existingTodo.setReminderSent(false);

        return todoRepository.save(existingTodo);
    }

    public Todo updateTodo(Long id, Todo updatedTodo) {
        return updateTodo(id, updatedTodo, null);
    }

    // Delete todo with ownership check
    public void deleteTodo(Long id, Long userId) {
        Todo existingTodo = todoRepository.findById(id)
                .orElseThrow(() -> new TodoNotFoundException(id));

        if (userId != null && existingTodo.getUser() != null && !existingTodo.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized: You can only delete your own tasks.");
        }

        todoRepository.delete(existingTodo);
    }

    public void deleteTodo(Long id) {
        deleteTodo(id, null);
    }
}
