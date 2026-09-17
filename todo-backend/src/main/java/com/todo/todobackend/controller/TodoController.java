package com.todo.todobackend.controller;

import com.todo.todobackend.model.Todo;
import com.todo.todobackend.service.TodoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@RestController
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*"}, allowCredentials = "true")
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    private Long resolveUserId(Long paramUserId, Long headerUserId) {
        return paramUserId != null ? paramUserId : headerUserId;
    }

    private LocalDateTime parseReminderDateTime(String reminderDateTime) {
        if (reminderDateTime == null || reminderDateTime.isBlank()) {
            return null;
        }
        try {
            // Trim seconds/millis if needed, or parse directly
            return LocalDateTime.parse(reminderDateTime);
        } catch (Exception e) {
            try {
                // Fallback in case format includes Z or offset
                return java.time.OffsetDateTime.parse(reminderDateTime).toLocalDateTime();
            } catch (Exception ex) {
                return null;
            }
        }
    }

    // =========================
    // GET ALL TODOS (FOR USER)
    // =========================

    @GetMapping
    public ResponseEntity<List<Todo>> getAllTodos(
            @RequestParam(required = false) Long userId,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        Long activeUserId = resolveUserId(userId, headerUserId);
        return ResponseEntity.ok(
                todoService.getTodosByUserId(activeUserId)
        );
    }

    // =========================
    // GET TODO BY ID
    // =========================

    @GetMapping("/{id}")
    public ResponseEntity<Todo> getTodoById(
            @PathVariable Long id) {
        return ResponseEntity.ok(
                todoService.getTodoById(id)
        );
    }

    // =========================
    // CREATE TODO
    // =========================

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Todo> createTodo(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam(defaultValue = "false") boolean completed,
            @RequestParam(required = false) String dueDate,
            @RequestParam(required = false) String dueTime,
            @RequestParam(required = false) String reminderDateTime,
            @RequestParam(required = false, defaultValue = "false") Boolean reminderEmail,
            @RequestParam(required = false) Long userId,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestPart(required = false) MultipartFile image
    ) {
        Long activeUserId = resolveUserId(userId, headerUserId);

        Todo todo = new Todo();
        todo.setTitle(title);
        todo.setDescription(description);
        todo.setCompleted(completed);

        if (dueDate != null && !dueDate.isBlank()) {
            todo.setDueDate(LocalDate.parse(dueDate));
        }

        if (dueTime != null && !dueTime.isBlank()) {
            todo.setDueTime(LocalTime.parse(dueTime));
        }

        todo.setReminderDateTime(parseReminderDateTime(reminderDateTime));
        todo.setReminderEmail(Boolean.TRUE.equals(reminderEmail));

        if (image != null && !image.isEmpty()) {
            try {
                todo.setImageData(image.getBytes());
                todo.setImageType(image.getContentType());
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
        }

        Todo createdTodo = todoService.createTodo(todo, activeUserId);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(createdTodo);
    }

    // =========================
    // UPDATE TODO
    // =========================

    @PutMapping(
            value = "/{id}",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<?> updateTodo(
            @PathVariable Long id,
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam(defaultValue = "false") boolean completed,
            @RequestParam(required = false) String dueDate,
            @RequestParam(required = false) String dueTime,
            @RequestParam(required = false) String reminderDateTime,
            @RequestParam(required = false, defaultValue = "false") Boolean reminderEmail,
            @RequestParam(required = false) Long userId,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestPart(required = false) MultipartFile image
    ) {
        Long activeUserId = resolveUserId(userId, headerUserId);

        Todo todo = new Todo();
        todo.setTitle(title);
        todo.setDescription(description);
        todo.setCompleted(completed);

        if (dueDate != null && !dueDate.isBlank()) {
            todo.setDueDate(LocalDate.parse(dueDate));
        }

        if (dueTime != null && !dueTime.isBlank()) {
            todo.setDueTime(LocalTime.parse(dueTime));
        }

        todo.setReminderDateTime(parseReminderDateTime(reminderDateTime));
        todo.setReminderEmail(Boolean.TRUE.equals(reminderEmail));

        if (image != null && !image.isEmpty()) {
            try {
                todo.setImageData(image.getBytes());
                todo.setImageType(image.getContentType());
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
        }

        try {
            Todo updatedTodo = todoService.updateTodo(id, todo, activeUserId);
            return ResponseEntity.ok(updatedTodo);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    // =========================
    // SNOOZE REMINDER
    // =========================

    @PatchMapping("/{id}/snooze")
    public ResponseEntity<?> snoozeTodo(
            @PathVariable Long id,
            @RequestParam(defaultValue = "10") int minutes,
            @RequestParam(required = false) Long userId,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        Long activeUserId = resolveUserId(userId, headerUserId);
        try {
            Todo snoozed = todoService.snoozeTodo(id, minutes, activeUserId);
            return ResponseEntity.ok(snoozed);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    // =========================
    // DELETE TODO
    // =========================

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTodo(
            @PathVariable Long id,
            @RequestParam(required = false) Long userId,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        Long activeUserId = resolveUserId(userId, headerUserId);
        try {
            todoService.deleteTodo(id, activeUserId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }
}
